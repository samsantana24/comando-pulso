const GROUP_ORDER = ['Salários', 'Freelancer', 'Comissões', 'Facilities', 'TI e Assinaturas', 'Outros Custos'];

const CATEGORIES_BY_GROUP = {
  'Salários': [
    'Cindy Steffany Donini', 'Erick Salgado', 'Juliana Costa Silva', 'Matheus Machado',
    'Pedro Paulo Morais da Silva', 'Polyana Luvizotto', 'Rachel Moghrabi', 'Sâmeque Santana',
    'Thalia Lourenço Batista', 'Yuri Rafael',
    'Closer 1 (entra na folha em julho)', 'Closer 2 (entra na folha em julho)',
    'SDR 1', 'SDR 2', 'SDR 3', 'Virginia', 'Victor',
  ],
  'Freelancer': ['Lays'],
  'Comissões': ['Estimativa Comissões'],
  'Facilities': [
    'Aluguel do Escritório', 'Condomínio / IPTU', 'Energia Elétrica', 'Água e Saneamento',
    'Internet / Telefonia', 'Limpeza e Conservação', 'Segurança / Portaria', 'Manutenção Predial',
    'Materiais de Escritório', 'Suprimentos de Copa e Cozinha', 'Equipamentos (Compra / Leasing)',
    'Outros — Facilities',
  ],
  'TI e Assinaturas': [
    'Google Workspace (BTG)', 'Ferramentas Diversas (BTG)', 'Microsoft 365', 'Claude / Anthropic API',
    'Zoom / Meet Pro', 'Slack', 'Notion / ClickUp', 'CRM (RVOPS)', 'Cloud (AWS / Azure / GCP)',
    'Antivírus / Segurança', 'Outros — TI e Assinaturas',
  ],
  'Outros Custos': [
    'Marketing e Publicidade', 'Tráfego Pago (Google / Meta Ads)', 'Honorários Contábeis / Jurídicos',
    'Impostos e Taxas', 'Seguros', 'Viagens e Deslocamentos', 'Transporte / Uber / Taxi',
    'Treinamento e Capacitação', 'Outros Custos Operacionais', 'Cartão Credito BTG',
  ],
};

function flatList() {
  const all = [];
  for (const [group, items] of Object.entries(CATEGORIES_BY_GROUP)) {
    for (const item of items) all.push({ group, name: item });
  }
  return all;
}

module.exports = { CATEGORIES_BY_GROUP, GROUP_ORDER, flatList };
