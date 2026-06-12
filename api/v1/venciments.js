// GET  /api/v1/venciments            llista (q, since, asseguradora, ram...)
// POST /api/v1/venciments            crear venciment des de l'ERP
//   L'ERP coneix les dates de venciment de les pòlisses: és el flux natural
//   ERP → CRM perquè el sistema 90/30/7 del CRM faci la resta.
import { makeResourceHandler } from '../_lib/erp-api.js';

export default makeResourceHandler({
  table: 'venciments',
  searchFields: ['empresa'],
  filterFields: ['asseguradora', 'ram'],
  createFields: ['empresa', 'ram', 'asseguradora', 'data_venciment', 'prima_actual', 'notes'],
  requiredOnCreate: ['empresa', 'data_venciment'],
  orderBy: 'data_venciment',
});
