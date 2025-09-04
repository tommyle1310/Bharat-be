import * as dao from './case.dao';

export async function list({limit = 100, offset = 0}) {
  return dao.list({limit, offset});
}