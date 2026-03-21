/* ================================================
   CANGEL GAMES ERP — Estado Global (Store)
   ================================================ */

export const AppState = {
  currentUser: null,
  activeTab: 'catalogo',
  activeFilter: 'semana',
  exchangeRate: 4200,

  users: [],       // Lista de usuarios (para login y permisos)
  auditLog: [],    // Bitácora de acontecimientos

  catalog: [],
  analysis: [],
  inventory: [],
  inventoryGames: [],
  inventoryCodes: [],
  sales: [],
  expenses: [],
  raffles: [],
  clients: [],
  paquetes: [],
  membresias: [],
  xboxInventory: [],
  physicalInventory: [],

  cart: [],
  charts: {},
  idealStock: {}, // Guardar stock ideal por título
  plantillas: {},
  ventasMode: 'facturacion',
};
