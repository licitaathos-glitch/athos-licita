// Gera um UUID v4 no mesmo formato usado pelo sistema Apps Script
import { randomUUID } from 'crypto'

export function novoId() {
  return randomUUID()
}
