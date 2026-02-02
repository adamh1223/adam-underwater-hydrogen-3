export const CUSTOMER_UPDATE_MUTATION = `#graphql
  # https://shopify.dev/docs/api/customer/latest/mutations/customerUpdate
  mutation customerUpdate(
    $customer: CustomerUpdateInput!
  ){
    customerUpdate(input: $customer) {
      customer {
        id
        firstName
        lastName
        emailAddress {
          emailAddress
        }
        phoneNumber {
          phoneNumber
        }
      }
      userErrors {
        code
        field
        message
      }
    }
  }
` as const;

export const CUSTOMER_UPDATE_WISHLIST =
  `mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields {
      key
      namespace
      value
      createdAt
      updatedAt
    }
    userErrors {
      field
      message
      code
    }
  }
}
` as const;

export const CUSTOMER_EMAIL_MARKETING_SUBSCRIBE = `#graphql
  mutation CustomerEmailMarketingSubscribe {
    customerEmailMarketingSubscribe {
      emailAddress {
        emailAddress
        marketingState
      }
      userErrors {
        field
        message
        code
      }
    }
  }
` as const;

export const CUSTOMER_EMAIL_MARKETING_UNSUBSCRIBE = `#graphql
  mutation CustomerEmailMarketingUnsubscribe {
    customerEmailMarketingUnsubscribe {
      emailAddress {
        emailAddress
        marketingState
      }
      userErrors {
        field
        message
        code
      }
    }
  }
` as const;
