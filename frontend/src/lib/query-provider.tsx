'use client'

/**
 * React Query provider — wraps the entire app so any page/component can use
 * useQuery / useMutation with automatic caching, deduplication, and background
 * refetching.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRef } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Stable QueryClient per tab — created only once
  const clientRef = useRef<QueryClient | null>(null)
  if (!clientRef.current) {
    clientRef.current = new QueryClient({
      defaultOptions: {
        queries: {
          // Show stale data immediately, revalidate in background
          staleTime: 30_000,       // data considered fresh for 30s
          gcTime: 5 * 60_000,      // keep unused data in cache for 5 min
          retry: 2,                // retry failed requests twice
          refetchOnWindowFocus: false,
        },
      },
    })
  }

  return (
    <QueryClientProvider client={clientRef.current}>
      {children}
    </QueryClientProvider>
  )
}
