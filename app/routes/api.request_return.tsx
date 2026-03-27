import {type ActionFunctionArgs, json} from '@shopify/remix-oxygen';
import {adminGraphql} from '~/lib/shopify-admin.server';
import {
  sendDirectEmail,
  ADMIN_NOTIFICATION_EMAIL,
} from '~/lib/email-provider.server';

const ADMIN_RETURN_REQUEST_MUTATION = `#graphql
  mutation ReturnRequest($input: ReturnRequestInput!) {
    returnRequest(input: $input) {
      return {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

type ReturnRequestResult = {
  data?: {
    returnRequest?: {
      return?: {id?: string; status?: string} | null;
      userErrors?: Array<{field?: string[]; message?: string}> | null;
    } | null;
  };
};

const RETURN_REASONS: Record<string, string> = {
  SIZE_TOO_SMALL: 'Size',
  COLOR: 'Color',
  STYLE: 'Style',
  UNWANTED: 'Changed my mind',
  NOT_AS_DESCRIBED: 'Item not as described',
  WRONG_ITEM: 'Received the wrong item',
  DEFECTIVE: 'Damaged or defective',
  OTHER: 'Other',
};

export async function action({request, context}: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ok: false, error: 'Method not allowed.'}, {status: 405});
  }

  const isLoggedIn = await context.customerAccount.isLoggedIn();
  if (!isLoggedIn) {
    return json(
      {ok: false, error: 'Please sign in to request a return.'},
      {status: 401},
    );
  }

  const formData = await request.formData();
  const orderId = (formData.get('orderId') as string | null)?.trim();
  const orderName = (formData.get('orderName') as string | null)?.trim();
  const reason = (formData.get('reason') as string | null)?.trim();
  const customerNote =
    (formData.get('customerNote') as string | null)?.trim() || '';
  const lineItemsJson = (formData.get('lineItems') as string | null)?.trim();

  if (!orderId) {
    return json({ok: false, error: 'Order ID is required.'}, {status: 400});
  }

  // Customer Account API order IDs have a ?key=... suffix that the Admin API rejects.
  // Strip it to get a clean GID like "gid://shopify/Order/12345".
  const adminOrderId = orderId.split('?')[0];

  if (!reason || !RETURN_REASONS[reason]) {
    return json(
      {ok: false, error: 'Please select a valid return reason.'},
      {status: 400},
    );
  }

  let returnLineItems: Array<{
    fulfillmentLineItemId: string;
    quantity: number;
  }> = [];

  if (lineItemsJson) {
    try {
      returnLineItems = JSON.parse(lineItemsJson) as Array<{
        fulfillmentLineItemId: string;
        quantity: number;
      }>;
    } catch {
      return json(
        {ok: false, error: 'Invalid line items data.'},
        {status: 400},
      );
    }
  }

  if (!returnLineItems.length) {
    return json(
      {ok: false, error: 'No items selected for return.'},
      {status: 400},
    );
  }

  // Submit the return request to Shopify Admin API
  try {
    const result = await adminGraphql<ReturnRequestResult>({
      env: context.env,
      query: ADMIN_RETURN_REQUEST_MUTATION,
      variables: {
        input: {
          orderId: adminOrderId,
          returnLineItems: returnLineItems.map((item) => ({
            fulfillmentLineItemId: item.fulfillmentLineItemId,
            quantity: item.quantity,
            returnReason: reason,
            customerNote: customerNote || undefined,
          })),
        },
      },
    });

    const userErrors = result?.data?.returnRequest?.userErrors ?? [];
    if (userErrors.length) {
      const errorMessage =
        userErrors[0]?.message || 'Unable to submit return request.';
      return json({ok: false, error: errorMessage}, {status: 400});
    }

    const returnId = result?.data?.returnRequest?.return?.id;
    if (!returnId) {
      return json(
        {ok: false, error: 'Unable to submit return request.'},
        {status: 500},
      );
    }

    // Send email notification via Resend
    try {
      const reasonLabel = RETURN_REASONS[reason] ?? reason;
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Return Request Received</h2>
          <p>A customer has submitted a return request.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5; font-weight: 600;">Order</td>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;">${orderName || orderId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5; font-weight: 600;">Reason</td>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;">${reasonLabel}</td>
            </tr>
            ${
              customerNote
                ? `<tr>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5; font-weight: 600;">Description</td>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;">${customerNote.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
            </tr>`
                : ''
            }
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5; font-weight: 600;">Items</td>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;">${returnLineItems.length} item${returnLineItems.length > 1 ? 's' : ''}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5; font-weight: 600;">Return ID</td>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;">${returnId}</td>
            </tr>
          </table>
          <p style="color: #666; font-size: 14px;">Review this return in your <a href="https://admin.shopify.com/" style="color: #2563eb;">Shopify Admin</a>.</p>
        </div>
      `;

      await sendDirectEmail({
        env: context.env,
        to: ADMIN_NOTIFICATION_EMAIL,
        subject: `Return Request - ${orderName || 'Order'}`,
        html: emailHtml,
        text: `Return Request for ${orderName || orderId}\nReason: ${reasonLabel}\n${customerNote ? `Description: ${customerNote}\n` : ''}Items: ${returnLineItems.length}\nReturn ID: ${returnId}`,
      });
    } catch (emailError) {
      console.error('Failed to send return request email notification', emailError);
      // Don't fail the request just because email failed
    }

    return json({ok: true, returnId});
  } catch (error) {
    console.error('Return request failed', error);
    // Surface Shopify GraphQL errors to help debug
    const errorMsg =
      error instanceof Error && error.message.includes('GraphQL errors')
        ? error.message
        : 'Unable to submit return request right now. Please try again later.';
    return json(
      {
        ok: false,
        error: errorMsg,
      },
      {status: 500},
    );
  }
}
