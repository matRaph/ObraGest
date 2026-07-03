export const NOME_MAX_LENGTH = 50;
export const DESCRICAO_MAX_LENGTH = 255;

export function limitText(value: string, max: number) {
  return value.slice(0, max);
}
