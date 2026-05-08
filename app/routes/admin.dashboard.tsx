import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, type MetaFunction} from '@remix-run/react';
import {ADMIN_CUSTOMER_ID} from '~/lib/admin';
import {adminGraphql} from '~/lib/shopify-admin.server';
import {CUSTOMER_WISHLIST} from '~/lib/customerQueries';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import {Card, CardContent} from '~/components/ui/card';

export const meta: MetaFunction = () => [
  {title: 'Admin Dashboard'},
  {name: 'robots', content: 'noindex, nofollow'},
];

type StockChannelEntry = {
  productId?: string | null;
  productTitle?: string | null;
  submittedAt?: string | null;
  youtube?: string | null;
  vimeo?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  facebook?: string | null;
  website?: string | null;
  independent?: string | null;
  advertisement?: string | null;
  other?: string | null;
};

type DashboardRow = {
  customerName: string;
  customerEmail: string;
  productId: string | null;
  productTitle: string;
  submittedAt: string | null;
  youtube: string;
  vimeo: string;
  instagram: string;
  tiktok: string;
  facebook: string;
  website: string;
  independent: string;
  advertisement: string;
  other: string;
};

type GroupedData = {
  productTitle: string;
  rows: DashboardRow[];
};

// Only query id + metafields — no PII fields (displayName/email) so we don't
// need the read_customers scope. Customer name/email are stored inside the
// metafield entry itself when the stock form is submitted.
const ADMIN_GET_CUSTOMER_CHANNELS_QUERY = `
  query AdminGetCustomerChannels($first: Int!, $after: String) {
    customers(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        metafields(namespace: "custom", first: 10) {
          nodes {
            key
            value
          }
        }
      }
    }
  }
`;

type AdminCustomerChannelsResponse = {
  data?: {
    customers?: {
      pageInfo?: {
        hasNextPage?: boolean;
        endCursor?: string | null;
      };
      nodes?: Array<{
        id: string;
        metafields?: {
          nodes?: Array<{key: string; value: string}>;
        } | null;
      }>;
    };
  };
};

export async function loader({context}: LoaderFunctionArgs) {
  // Check admin status server-side
  let customer = null;
  try {
    customer = await context.customerAccount.query(CUSTOMER_WISHLIST);
  } catch {
    customer = null;
  }

  const customerId = customer?.data?.customer?.id ?? null;
  const isAdmin = customerId === ADMIN_CUSTOMER_ID;

  if (!isAdmin) {
    throw redirect('/');
  }

  const allRows: DashboardRow[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;
  let debugError: string | null = null;
  let debugNodeCount = 0;

  while (hasNextPage) {
    const variables: Record<string, unknown> = {first: 50};
    if (cursor) variables.after = cursor;

    let response: AdminCustomerChannelsResponse | null = null;
    try {
      response = await adminGraphql<AdminCustomerChannelsResponse>({
        env: context.env,
        query: ADMIN_GET_CUSTOMER_CHANNELS_QUERY,
        variables,
      });
    } catch (err) {
      debugError = String(err);
      break;
    }

    debugNodeCount += response?.data?.customers?.nodes?.length ?? 0;

    const customersData = response?.data?.customers;
    const nodes = customersData?.nodes ?? [];

    for (const node of nodes) {
      const stockChannelMeta = node.metafields?.nodes?.find(
        (m) => m.key === 'stock_channels',
      );
      if (!stockChannelMeta?.value) continue;

      let entries: StockChannelEntry[] = [];
      try {
        const parsed = JSON.parse(stockChannelMeta.value);
        if (Array.isArray(parsed)) {
          entries = parsed as StockChannelEntry[];
        }
      } catch {
        continue;
      }

      for (const entry of entries) {
        allRows.push({
          customerName: (entry as any).customerName ?? '',
          customerEmail: (entry as any).customerEmail ?? '',
          productId: entry.productId ?? null,
          productTitle: entry.productTitle ?? 'Unknown Product',
          submittedAt: entry.submittedAt ?? null,
          youtube: entry.youtube ?? '',
          vimeo: entry.vimeo ?? '',
          instagram: entry.instagram ?? '',
          tiktok: entry.tiktok ?? '',
          facebook: entry.facebook ?? '',
          website: entry.website ?? '',
          independent: entry.independent ?? '',
          advertisement: entry.advertisement ?? '',
          other: entry.other ?? '',
        });
      }
    }

    hasNextPage = customersData?.pageInfo?.hasNextPage ?? false;
    cursor = customersData?.pageInfo?.endCursor ?? null;
  }

  // Group by productTitle
  const groupMap = new Map<string, DashboardRow[]>();
  for (const row of allRows) {
    const key = row.productTitle;
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)!.push(row);
  }

  const groupedData: GroupedData[] = Array.from(groupMap.entries()).map(
    ([productTitle, rows]) => ({productTitle, rows}),
  );

  return {groupedData, debugError, debugNodeCount};
}

export default function AdminDashboard() {
  const {groupedData, debugError, debugNodeCount} = useLoaderData<typeof loader>();

  const hasData = groupedData.length > 0;

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      {/* Temporary debug banner — remove once working */}
      <div className="mb-4 p-3 rounded border border-yellow-500 text-yellow-300 text-sm font-mono">
        <div>Customers fetched: {debugNodeCount}</div>
        {debugError && <div className="text-red-400 mt-1">Error: {debugError}</div>}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b">
            <h2 className="text-lg font-semibold">Customer Channels</h2>
          </div>

          {!hasData ? (
            <div className="p-8 text-center text-muted-foreground">
              No stock channel submissions yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Product</TableHead>
                    <TableHead className="whitespace-nowrap">Customer</TableHead>
                    <TableHead className="whitespace-nowrap">Email</TableHead>
                    <TableHead className="whitespace-nowrap">YouTube</TableHead>
                    <TableHead className="whitespace-nowrap">Vimeo</TableHead>
                    <TableHead className="whitespace-nowrap">Instagram</TableHead>
                    <TableHead className="whitespace-nowrap">TikTok</TableHead>
                    <TableHead className="whitespace-nowrap">Facebook</TableHead>
                    <TableHead className="whitespace-nowrap">Website</TableHead>
                    <TableHead className="whitespace-nowrap">Independent</TableHead>
                    <TableHead className="whitespace-nowrap">Advertisement</TableHead>
                    <TableHead className="whitespace-nowrap">Other</TableHead>
                    <TableHead className="whitespace-nowrap">Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedData.map((group) => (
                    <>
                      <TableRow
                        key={`group-header-${group.productTitle}`}
                        className="bg-muted/50"
                      >
                        <TableCell
                          colSpan={13}
                          className="font-semibold text-primary py-2 px-4"
                        >
                          {group.productTitle}
                        </TableCell>
                      </TableRow>
                      {group.rows.map((row, idx) => (
                        <TableRow key={`${group.productTitle}-${idx}`}>
                          <TableCell className="whitespace-nowrap">
                            {row.productTitle}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {row.customerName}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {row.customerEmail}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate">
                            {row.youtube}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate">
                            {row.vimeo}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate">
                            {row.instagram}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate">
                            {row.tiktok}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate">
                            {row.facebook}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate">
                            {row.website}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate">
                            {row.independent}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate">
                            {row.advertisement}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate">
                            {row.other}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {row.submittedAt
                              ? new Date(row.submittedAt).toLocaleDateString()
                              : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
