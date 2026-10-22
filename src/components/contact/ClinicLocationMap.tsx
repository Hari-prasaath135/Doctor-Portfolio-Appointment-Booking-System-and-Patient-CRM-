  "use client"

  /**
   * ClinicLocationMap
   * ------------------
   * Renders an interactive Mapbox map with a pin at the clinic's address.
   *
   * SETUP
   * 1. npm install mapbox-gl
   * 2. Add your Mapbox token to .env.local:
   *      NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_public_token_here
   *    (Get a free token at https://account.mapbox.com/access-tokens/ —
   *    use a "public" pk. token, never a secret sk. token, on the client.)
   * 3. Import the mapbox-gl stylesheet once, e.g. in your root layout:
   *      import "mapbox-gl/dist/mapbox-gl.css"
   * 4. Drop this component anywhere, e.g. on a #contact section:
   *      <ClinicLocationMap />
   *
   * HOW IT LOCATES THE CLINIC
   * clinicInfo only has a text address, not coordinates. On mount, this
   * component geocodes that address once via the Mapbox Geocoding API and
   * caches the resulting [lng, lat] in state. If you'd rather skip the
   * geocoding call (faster load, no chance of a bad match), replace
   * FALLBACK_COORDS below with the clinic's real coordinates (look them
   * up once on google maps / mapbox and hardcode them) and the component
   * will use those directly.
   */

  import { useEffect, useRef, useState } from "react"
  import mapboxgl from "mapbox-gl"
  import { clinicInfo } from "@/lib/data" // adjust import path to wherever doctorInfo.ts lives

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  // Optional: set this to the clinic's real [lng, lat] to skip geocoding entirely.
  const FALLBACK_COORDS: [number, number] | null = null

  export default function ClinicLocationMap() {
    const mapContainer = useRef<HTMLDivElement | null>(null)
    const mapRef = useRef<mapboxgl.Map | null>(null)
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
    const [errorMessage, setErrorMessage] = useState<string>("")

    useEffect(() => {
      if (!MAPBOX_TOKEN) {
        setStatus("error")
        setErrorMessage("Missing NEXT_PUBLIC_MAPBOX_TOKEN environment variable.")
        return
      }
      mapboxgl.accessToken = MAPBOX_TOKEN

      let cancelled = false
      let mapInstance: mapboxgl.Map | null = null
      let markerInstance: mapboxgl.Marker | null = null
      let resizeRafId: number | null = null

      async function initMap() {
        try {
          let coords = FALLBACK_COORDS

          if (!coords) {
            const query = encodeURIComponent(clinicInfo.address)
            const res = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_TOKEN}&limit=1`
            )
            if (!res.ok) throw new Error(`Geocoding request failed (${res.status})`)
            const data = await res.json()
            const feature = data?.features?.[0]
            if (!feature) throw new Error("No match found for the clinic address.")
            coords = feature.center as [number, number] // [lng, lat]
          }

          if (cancelled || !mapContainer.current) return

          // Ensure container is present in the DOM and has layout dimensions
          const container = mapContainer.current
          const rect = container.getBoundingClientRect()
          if (rect.width === 0 && rect.height === 0) {
            // Wait for next frame when layout is calculated
            await new Promise((resolve) => requestAnimationFrame(resolve))
            if (cancelled || !mapContainer.current) return
          }

          const map = new mapboxgl.Map({
            container: mapContainer.current,
            style: "mapbox://styles/mapbox/streets-v12",
            center: coords,
            zoom: 15,
          })
          mapInstance = map
          mapRef.current = map

          map.addControl(new mapboxgl.NavigationControl(), "top-right")

          const popupHtml = `
            <div style="font-family: inherit; padding: 4px 2px;">
              <strong>${clinicInfo.name}</strong><br/>
              <span style="font-size: 13px; color: #555;">${clinicInfo.address}</span>
            </div>
          `

          const popup = new mapboxgl.Popup({ offset: 24 }).setHTML(popupHtml)
          const marker = new mapboxgl.Marker({ color: "#D6336C" })
            .setLngLat(coords)
            .setPopup(popup)
            .addTo(map)
          markerInstance = marker

          // Listen for map errors gracefully
          map.on("error", (e) => {
            if (!cancelled) {
              console.warn("Mapbox GL runtime notice:", e?.error?.message || e)
            }
          })

          // Resize only after the map is fully loaded and rendering resources ready
          map.once("load", () => {
            if (cancelled || !mapRef.current) return
            resizeRafId = requestAnimationFrame(() => {
              if (!cancelled && mapRef.current) {
                mapRef.current.resize()
                setStatus("ready")
              }
            })
          })
        } catch (err) {
          if (cancelled) return
          setStatus("error")
          setErrorMessage(err instanceof Error ? err.message : "Failed to load map.")
        }
      }

      initMap()

      return () => {
        cancelled = true
        if (resizeRafId !== null) {
          cancelAnimationFrame(resizeRafId)
        }
        if (markerInstance) {
          markerInstance.remove()
          markerInstance = null
        }
        if (mapInstance) {
          mapInstance.remove()
          mapInstance = null
        }
        mapRef.current = null
      }
    }, [])

    return (
      <div className="w-full">
        <div
          ref={mapContainer}
          className="w-full h-[340px] rounded-xl overflow-hidden border border-neutral-200"
        />
        {status === "loading" && (
          <p className="mt-2 text-sm text-neutral-500">Loading map…</p>
        )}
        {status === "error" && (
          <p className="mt-2 text-sm text-red-600">
            Couldn't load the map: {errorMessage}
          </p>
        )}
      </div>
    )
  }