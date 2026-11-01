import { gql } from '@apollo/client';

export const GET_ALL_GENRES = gql`
  query GetAllGenres($includeInactive: Boolean) {
    getAllGenres(includeInactive: $includeInactive) {
      id
      name
      group
      sortOrder
      isActive
      slug
      description

      hexColor
      createdAt
      updatedAt
    }
  }
`;
