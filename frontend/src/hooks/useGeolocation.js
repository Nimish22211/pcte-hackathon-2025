import { useState, useEffect, useRef } from 'react'
import { getCurrentLocation } from '../services/mapService'

export const useGeolocation = () => {
  const [location, setLocation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [initialLocationFetched, setInitialLocationFetched] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Explicit request (the "Get location" button): always asks the browser again
  const getLocation = async () => {
    setLoading(true)
    setError(null)

    try {
      const coords = await getCurrentLocation()
      if (mounted.current) setLocation(coords)
      return coords
    } catch (err) {
      if (mounted.current) setError(err.message)
      throw err
    } finally {
      if (mounted.current) setLoading(false)
    }
  }

  // Try once when the page opens. Failing silently is fine: the button can be used afterwards.
  useEffect(() => {
    let cancelled = false

    getCurrentLocation()
      .then((coords) => {
        if (!cancelled) setLocation(coords)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setInitialLocationFetched(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return {
    location,
    loading,
    error,
    getLocation,
    initialLocationFetched
  }
}
