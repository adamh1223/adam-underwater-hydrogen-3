export const CUSTOMER_WISHLIST = `
  query {
    customer {
      id
      firstName
      metafield(namespace: "custom", key: "wishlist") {
        id
        namespace
        key
        type
        value
      }
    }
  }
`;

export const variantQuery = `#graphql
    query Variant($id: ID!) {
      node(id: $id) {
        ... on ProductVariant {
          id
          selectedOptions {
            name
            value
          }
          product {
            id
            handle
            tags
          }
        }
      }
    }
  `;

export const productQuery = `#graphql
  query Product($id: ID!) {
    node(id: $id) {
      ... on Product {
        id
        title
        tags
        vendor
        handle
        descriptionHtml
        description
        featuredImage {
          url
        }
        encodedVariantExistence
        encodedVariantAvailability
        images(first: 250) {
          nodes {
            url
            altText
          }
        }
        options {
          name
          optionValues {
            name
            swatch {
              color
              image {
                previewImage {
                  url
                  altText
                }
              }
            }
          }
        }
        seo {
          description
          title
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        selectedOrFirstAvailableVariant {
          id
          title
          availableForSale
          compareAtPrice {
            amount
            currencyCode
          }
          price {
            amount
            currencyCode
          }
        }
      }
    }
  }
`;
