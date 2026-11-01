import { jest } from '@jest/globals';
import { graphql } from 'graphql';
import schema from '../src/graphql/schema.js';
import { connect, clearDatabase, closeDatabase } from './db.js';
import Genre from '../src/models/genre.js';
import * as genres from '../src/services/genreService.js';

jest.setTimeout(30000);
beforeAll(connect);
afterAll(closeDatabase);
afterEach(clearDatabase);
beforeEach(async () => {
  await Genre.create([
    { name: 'Roman', slug: 'roman', classificationVersion: 1 },
    { name: 'Gizem', slug: 'gizem', classificationVersion: 1 },
    { name: 'Inactive', slug: 'inactive', classificationVersion: 1, isActive: false },
    { name: 'Legacy', slug: 'legacy' },
  ]);
});

test('public genres are current, active, and sorted by name while legacy entries stay excluded', async () => {
  expect((await genres.getAllGenres()).map(g => g.slug)).toEqual(['gizem', 'roman']);
  expect((await genres.getAllGenres(true)).map(g => g.slug)).toEqual(['gizem', 'inactive', 'roman']);
  expect((await genres.getGenreBySlug('roman')).name).toBe('Roman');
});

test.each(['inactive', 'legacy', 'unknown'])('unavailable genre slug %s fails', async slug => {
  await expect(genres.getGenreBySlug(slug)).rejects.toThrow();
});

test('GraphQL hides legacy icons and restricts inactive genres to admins', async () => {
  await Genre.updateOne({ slug: 'roman' }, { iconUrl: 'obsolete.svg' });
  const result = await graphql({ schema, source: '{getAllGenres{slug iconUrl}}' });
  expect(result.errors).toBeUndefined();
  expect(result.data.getAllGenres).toEqual([{ slug: 'gizem', iconUrl: '' }, { slug: 'roman', iconUrl: '' }]);
  expect((await graphql({ schema, source: '{getAllGenres(includeInactive:true){id}}', contextValue: {} })).errors).toBeDefined();
});
