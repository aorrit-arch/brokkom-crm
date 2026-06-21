// GET  /api/v1/clients            llista (q, since, sector, limit, offset)
// GET  /api/v1/clients?id=<uuid>  un client
// POST /api/v1/clients            crear client des de l'ERP
import { makeResourceHandler } from '../_lib/erp-api.js';

export default makeResourceHandler({
  table: 'clients',
  searchFields: ['empresa', 'cif', 'contacte', 'email'],
  filterFields: ['sector', 'cif'],
  createFields: ['empresa', 'cif', 'sector', 'treballadors', 'contacte', 'carrec', 'email', 'telefon', 'adreca', 'facturacio', 'notes'],
  requiredOnCreate: ['empresa'],
  orderBy: 'created_at',
});
