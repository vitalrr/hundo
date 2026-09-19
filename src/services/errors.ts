// Compatibility with the currently deployed server's legacy error messages.
const serverErrors: Record<string, string> = {
  'Не удалось обработать запрос': 'Could not process the request. Please try again.',
  'Некорректный ID': 'Invalid game ID.',
  'Подожди несколько минут перед повторным входом': 'Please wait a few minutes before connecting again.',
  'Запрос входа истёк или уже использован. Подключись заново.': 'This sign-in request has expired or was already used. Reconnect your wallet.',
  'Кошелёк не вернул подпись': 'Your wallet did not return a signature. Please try again.',
  'Запрос входа уже использован': 'This sign-in request was already used. Reconnect your wallet.',
  'Подключи кошелёк заново': 'Please reconnect your wallet.',
  'Сессия истекла. Подключи кошелёк заново': 'Your session has expired. Please reconnect your wallet.',
  'Некорректная транзакция': 'Invalid transaction.',
  'Транзакция пока не финализирована': 'The transaction is not finalized yet. Check it again shortly.',
  'Транзакция не подтверждает участие в этом раунде': 'This transaction does not confirm entry to this game.',
  'Некорректный ответ': 'Invalid answer.',
  'Ответ не принят: время вышло, ответ уже зафиксирован или ты выбыл.': 'Answer not accepted: time ran out, your answer was already locked, or you were eliminated.',
  'Ошибка запроса': 'The request failed. Please try again.',
};

export function serverErrorMessage(value: unknown): string {
  if (typeof value !== 'string' || !value) return 'Could not reach the server. Please try again.';
  if (serverErrors[value]) return serverErrors[value];
  if (value.startsWith('Подпись не прошла проверку')) return 'Could not verify your signature. Please reconnect your wallet.';
  return /[А-Яа-яЁё]/.test(value) ? 'The request failed. Please try again.' : value;
}
