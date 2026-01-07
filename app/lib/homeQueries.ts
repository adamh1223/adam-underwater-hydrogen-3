export const FEATURED_COLLECTION_QUERY = `#graphql
  fragment FeaturedCollection on Collection {
    id
    title
    image {
      id
      url
      altText
      width
      height
    }
    handle
    metafield(namespace: "custom", key: "multiple_images"){
      references(first: 10) {
        nodes {
          ... on MediaImage {
            image {url}
          }
        }
      }
    }
  }
  query FeaturedCollection($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collections(first: 1, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...FeaturedCollection
      }
    }
  }
` as const;

export const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  fragment RecommendedProduct on Product {
    id
    title
    handle
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    tags
    images(first: 250) {
      nodes {
        id
        url
        altText
        width
        height
      }
    }
  }
  query RecommendedProducts ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 25, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...RecommendedProduct
      }
    }
  }
` as const;

export const FEATURED_REVIEWS_QUERY = `#graphql
  query FeaturedReviews($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 25, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        id
        title
        metafield(namespace: "custom", key: "reviews") {
          value
        }
      }
    }
  }
` as const;

export const POST_REVIEW_MUTATION = `#graphql 
  mutation MetafieldsSet($metafields: MetafieldsSetInput!) {
  metafieldsSet(metafields: $metafields) {
        metafields {
            id
            value
        }
    }
  }
`;
export const GET_REVIEW_QUERY = `#graphql 
  query getReview ($productId: ID!) {
    product(id: $productId) {
        metafield (namespace: "custom", key: "reviews") {
            id
            value
        }
    }
  }
`;

export const ADMIN_METAFIELD_SET = `#graphql
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        key
        namespace
        value
      }
      userErrors {
        field
        message
      }
    }
  }
`;
