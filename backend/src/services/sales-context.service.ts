export interface SalesContext {
  sellerName: string
  sellerCompany: string
  productName: string
  productDescription: string
}

export function validateSalesContext(value: unknown): SalesContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Seller and product context is required before drafting.')
  const source = value as Record<string, unknown>
  const fields = ['sellerName', 'sellerCompany', 'productName', 'productDescription'] as const
  const result = {} as SalesContext
  for (const field of fields) {
    const text = source[field]
    if (typeof text !== 'string' || !text.trim() || text.trim().length > (field === 'productDescription' ? 1000 : 120)) {
      throw new Error(`${field} is required and must be within the allowed length.`)
    }
    result[field] = text.trim()
  }
  return result
}
