// Asaas API client wrapper
// All calls are server-side only — never import this in client components

const BASE_URL = process.env.ASAAS_BASE_URL ?? 'https://api.asaas.com/v3'
const API_KEY = process.env.ASAAS_API_KEY ?? ''
const IS_MOCK = process.env.ASAAS_MOCK === 'true' && process.env.NODE_ENV !== 'production'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BillingType = 'CREDIT_CARD' | 'PIX' | 'BOLETO'
export type BillingCycle = 'MONTHLY' | 'YEARLY'

export interface AsaasCustomer {
  id: string
  name: string
  email: string
  cpfCnpj?: string
}

export interface AsaasSubscription {
  id: string
  status: string
  nextDueDate: string
  billingType: BillingType
  cycle: BillingCycle
  value: number
  description?: string
}

export interface AsaasPayment {
  id: string
  status: string
  billingType: BillingType
  value: number
  pixQrCodeImage?: string
  pixCopiaECola?: string
  bankSlipUrl?: string
  invoiceUrl?: string
  nossoNumero?: string
}

export interface CreateCustomerInput {
  name: string
  email: string
  cpfCnpj?: string
  phone?: string
}

export interface CreateSubscriptionInput {
  customer: string        // Asaas customer ID
  billingType: BillingType
  value: number
  nextDueDate: string     // YYYY-MM-DD
  cycle: BillingCycle
  description?: string
  creditCard?: AsaasCreditCard
  creditCardHolderInfo?: AsaasCreditCardHolderInfo
  remoteIp?: string
}

export interface AsaasCreditCard {
  holderName: string
  number: string
  expiryMonth: string
  expiryYear: string
  ccv: string
}

export interface AsaasCreditCardHolderInfo {
  name: string
  email: string
  cpfCnpj: string
  postalCode?: string
  addressNumber?: string
  phone?: string
}

// ─── Mock helpers ──────────────────────────────────────────────────────────────

function mockCustomer(input: CreateCustomerInput): AsaasCustomer {
  return { id: `cus_mock_${Date.now()}`, name: input.name, email: input.email }
}

function mockSubscription(input: CreateSubscriptionInput): AsaasSubscription {
  return {
    id: `sub_mock_${Date.now()}`,
    status: 'ACTIVE',
    nextDueDate: input.nextDueDate,
    billingType: input.billingType,
    cycle: input.cycle,
    value: input.value,
  }
}

// ─── HTTP helper ───────────────────────────────────────────────────────────────

async function asaasRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': API_KEY,
      'User-Agent': 'MedLibre/1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Asaas ${method} ${path} → ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

// ─── Customer ──────────────────────────────────────────────────────────────────

export async function findOrCreateCustomer(input: CreateCustomerInput): Promise<AsaasCustomer> {
  if (IS_MOCK) return mockCustomer(input)

  // Try to find by email first
  const list = await asaasRequest<{ data: AsaasCustomer[] }>(
    'GET',
    `/customers?email=${encodeURIComponent(input.email)}&limit=1`,
  )
  if (list.data.length > 0) return list.data[0]

  return asaasRequest<AsaasCustomer>('POST', '/customers', {
    name: input.name,
    email: input.email,
    cpfCnpj: input.cpfCnpj,
    phone: input.phone,
  })
}

// ─── Subscription ──────────────────────────────────────────────────────────────

export async function createSubscription(input: CreateSubscriptionInput): Promise<AsaasSubscription> {
  if (IS_MOCK) return mockSubscription(input)
  return asaasRequest<AsaasSubscription>('POST', '/subscriptions', input)
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  if (IS_MOCK) return
  await asaasRequest<unknown>('DELETE', `/subscriptions/${subscriptionId}`)
}

export async function getSubscription(subscriptionId: string): Promise<AsaasSubscription> {
  if (IS_MOCK) {
    return {
      id: subscriptionId,
      status: 'ACTIVE',
      nextDueDate: new Date().toISOString().slice(0, 10),
      billingType: 'PIX',
      cycle: 'MONTHLY',
      value: 79.9,
    }
  }
  return asaasRequest<AsaasSubscription>('GET', `/subscriptions/${subscriptionId}`)
}

// ─── Payments ──────────────────────────────────────────────────────────────────

export async function getSubscriptionPayments(subscriptionId: string): Promise<AsaasPayment[]> {
  if (IS_MOCK) return []
  const res = await asaasRequest<{ data: AsaasPayment[] }>(
    'GET',
    `/payments?subscription=${subscriptionId}&limit=1`,
  )
  return res.data
}

// ─── Error message map (PT-BR) ─────────────────────────────────────────────────

export const ASAAS_ERROR_MESSAGES: Record<string, string> = {
  'invalid_action':                     'Ação inválida. Tente novamente.',
  'invalid_cpfCnpj':                    'CPF ou CNPJ inválido.',
  'creditCard.number.invalid':          'Número do cartão inválido.',
  'creditCard.holderName.invalid':      'Nome do titular inválido.',
  'creditCard.expiryDate.invalid':      'Data de vencimento inválida.',
  'creditCard.ccv.invalid':             'CVV inválido.',
  'creditCard.unauthorized':            'Cartão não autorizado. Verifique os dados ou entre em contato com seu banco.',
  'creditCard.insufficient_funds':      'Saldo insuficiente.',
  'creditCard.expired':                 'Cartão vencido.',
  'creditCard.blocked':                 'Cartão bloqueado.',
  'customer.not_found':                 'Cliente não encontrado.',
  'subscription.not_found':             'Assinatura não encontrada.',
  'duplicate_subscription':             'Você já possui uma assinatura ativa.',
}

export function translateAsaasError(rawError: string): string {
  for (const [key, msg] of Object.entries(ASAAS_ERROR_MESSAGES)) {
    if (rawError.toLowerCase().includes(key.toLowerCase())) return msg
  }
  return 'Ocorreu um erro no pagamento. Tente novamente ou entre em contato com o suporte.'
}
