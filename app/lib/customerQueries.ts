export const CUSTOMER_WISHLIST = `#graphql
query getWishList ($token: String!) {
customer(customerAccessToken: $token) {
    firstName
    metafield(namespace: "custom", key: "wishlist") {
        reference {
        
          ... on Product {
            title
          }
        
      }
    }
}
}
`;
export const test = `#graphql
query testCustomer($token: String!) {
    customer(customerAccessToken: $token) {
        id
        firstName
        
    }
}`;
