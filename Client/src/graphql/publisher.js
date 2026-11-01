import { gql } from '@apollo/client';

export const PUBLISHER_CATALOG = gql`
  query PublisherCatalog($page: Int!, $limit: Int!, $search: String!, $funding: PublisherFundingFilter!) {
    publisherCatalog(page: $page, limit: $limit, search: $search, funding: $funding) {
      total page totalPages refreshedAt
      items {
        id urlSlug title imageUrl authorName writingStatus publishDate
        campaign { id state environment targetMinor acceptedMinor supporterCount endsAt updatedAt }
      }
    }
  }
`;
