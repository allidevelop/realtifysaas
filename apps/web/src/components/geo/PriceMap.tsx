'use client'

import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { Layer, LeafletMouseEvent, PathOptions } from 'leaflet'
import L from 'leaflet'
import { useEffect } from 'react'
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet'

import 'leaflet/dist/leaflet.css'

export interface UnitProps {
  id: number
  name: string
  level: number
  parentId: number | null
  code?: string | null
  population?: number | null
}

interface PriceMapProps {
  geojson: FeatureCollection
  values: Record<string, number>
  formatValue: (v: number) => string
  onSelect: (id: number, name: string, level: number) => void
  // Ключ перерисовки слоя (при смене уровня/периода/метрики).
  dataKey: string
}

const SCALE_FROM = [224, 236, 255] // #e0ecff
const SCALE_TO = [27, 68, 173] // #1b44ad

function colorFor(value: number | undefined, min: number, max: number): string {
  if (value === undefined) return '#e5e7eb'
  const t = max > min ? (value - min) / (max - min) : 0.5
  const c = SCALE_FROM.map((f, i) => Math.round(f + (SCALE_TO[i] - f) * t))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

function FitToData({ geojson, dataKey }: { geojson: FeatureCollection; dataKey: string }) {
  const map = useMap()
  useEffect(() => {
    try {
      const layer = L.geoJSON(geojson)
      const b = layer.getBounds()
      if (b.isValid()) map.fitBounds(b, { padding: [20, 20] })
    } catch {
      // пустой/битый geojson — игнор
    }
  }, [map, geojson, dataKey])
  return null
}

export default function PriceMap({
  geojson,
  values,
  formatValue,
  onSelect,
  dataKey,
}: PriceMapProps) {
  const nums = Object.values(values)
  const min = nums.length ? Math.min(...nums) : 0
  const max = nums.length ? Math.max(...nums) : 1

  const style = (feature?: Feature<Geometry, UnitProps>): PathOptions => {
    const v = feature ? values[String(feature.properties.id)] : undefined
    return {
      fillColor: colorFor(v, min, max),
      weight: 1,
      opacity: 1,
      color: '#ffffff',
      fillOpacity: 0.8,
    }
  }

  const onEachFeature = (feature: Feature<Geometry, UnitProps>, layer: Layer) => {
    const p = feature.properties
    const v = values[String(p.id)]
    layer.bindTooltip(`${p.name}: ${v !== undefined ? formatValue(v) : '—'}`, { sticky: true })
    layer.on({
      mouseover: (e: LeafletMouseEvent) => {
        const t = e.target as L.Path
        t.setStyle({ weight: 2.5, color: '#1b44ad', fillOpacity: 0.95 })
        t.bringToFront()
      },
      mouseout: (e: LeafletMouseEvent) => {
        const t = e.target as L.Path
        t.setStyle({ weight: 1, color: '#ffffff', fillOpacity: 0.8 })
      },
      click: () => onSelect(p.id, p.name, p.level),
    })
  }

  return (
    <MapContainer
      center={[48.3, 31.2]}
      zoom={6}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <GeoJSON
        key={dataKey}
        data={geojson}
        style={style as L.StyleFunction}
        onEachFeature={onEachFeature}
      />
      <FitToData geojson={geojson} dataKey={dataKey} />
    </MapContainer>
  )
}
