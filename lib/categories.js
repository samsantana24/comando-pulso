const CATEGORIES_BY_GROUP = {
  'Salários': [
    'Cindy Steffany Donini', 'Erick Salgado', 'Juliana Costa Silva', 'Matheus Machado',
    'Pedro Paulo Morais da Silva', 'Polyana Luvizotto', 'Rachel Moghrabi', 'Sâmeque Santana',
    'Thalia Lourenço Batista', 'Yuri Rafael', 'Lays (Freelancer)',
  ],
  'Comissões': ['Estimativa Comissões'],
  'Facilities': [
    'Aluguel do Escritório', 'Condomínio/IPTU', 'Energia Elétrica', 'Água e Saneamento',
    'Internet/Telefonia', 'Limpeza e Conservação', 'Segurança/Portaria', 'Manutenção Predial',
    'Materiais de Escritório', 'Suprimentos de Copa e Cozinha', 'Equipamentos', 'Outros Facilities',
  ],
  'TI e Assinaturas': [
    'Google Workspace (BTG)', 'Ferramentas Diversas (BTG)', 'Microsoft 365', 'Claude/Anthropic API',
    'Zoom/Meet Pro', 'Slack', 'Notion/ClickUp', 'CRM (RVOPS)', 'Cloud (AWS/Azure/GCP)',
    'Antivírus/Segurança', 'Outros TI',
  ],
  'Outros Custos': [
    'Marketing e Publicidade', 'Tráfego Pago (Google/Meta Ads)', 'Honorários Contábeis/Jurídicos',
    'Impostos e Taxas', 'Seguros', 'Viagens e Deslocamentos', 'Transporte/Uber/Taxi',
    'Treinamento e Capacitação', 'Outros Operacionais', 'Cartão de Crédito BTG',
  ],
};

function flatList() {
  const all = [];
  for (const [group, items] of Object.entries(CATEGORIES_BY_GROUP)) {
    for (const item of items) all.push({ group, name: item });
  }
  return all;
}

module.exports = { CATEGORIES_BY_GROUP, flatList };
