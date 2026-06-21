// GET /api/v1/ofertes — pipeline comercial (només lectura per a l'ERP)
// Filtres: q, since, estat, ram, asseguradora, mediador, limit, offset
import { makeResourceHandler } from '../_lib/erp-api.js';

export default makeResourceHandler({
  table: 'ofertes',
  searchFields: ['empresa'],
  filterFields: ['estat', 'ram', 'asseguradora', 'mediador'],
  createFields: null,
  orderBy: 'created_at',
});
