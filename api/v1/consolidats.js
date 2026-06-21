// GET /api/v1/consolidats  — tancaments guanyats (només lectura per a l'ERP)
// Filtres: q, since, asseguradora, ram, mediador, num_polissa, limit, offset
import { makeResourceHandler } from '../_lib/erp-api.js';

export default makeResourceHandler({
  table: 'consolidats',
  searchFields: ['empresa', 'num_polissa'],
  filterFields: ['asseguradora', 'ram', 'mediador', 'num_polissa'],
  createFields: null, // només lectura: els tancaments es registren al CRM
  orderBy: 'data_tancament',
});
