// Retorna a data "hoje" no fuso de Brasília (America/Sao_Paulo, UTC-3).
// O preview/produção roda em UTC, então new Date() puro às 21h de Brasília
// já vira o dia seguinte (00:00 UTC). Esta função garante que "hoje" seja
// sempre a data correta no horário de Brasília.
export function getBrasiliaToday() {
  const str = new Date().toLocaleString('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const [month, day, year] = str.split('/');
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}