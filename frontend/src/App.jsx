import React from 'react'
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/Auth.jsx'
import { api } from './lib/api.js'
import './App.css'
import 'leaflet/dist/leaflet.css'
// Load Google Maps JS API on demand
function useLoadGoogleMaps() {
  const [ready, setReady] = React.useState(!!window.google?.maps)
  React.useEffect(() => {
    if (window.google?.maps) { setReady(true); return }
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!key) return
    const src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`
    if (document.querySelector(`script[src^="https://maps.googleapis.com/maps/api/js"]`)) return
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => setReady(true)
    document.head.appendChild(s)
  }, [])
  return ready
}

function MapPicker({ value, onChange }) {
  const ready = useLoadGoogleMaps()
  const mapRef = React.useRef(null)
  const inputRef = React.useRef(null)
  const zipRef = React.useRef(null)
  const markerRef = React.useRef(null)
  const mapObjRef = React.useRef(null)
  const [osmSuggestions, setOsmSuggestions] = React.useState([])
  const [osmLoading, setOsmLoading] = React.useState(false)
  const [showSug, setShowSug] = React.useState(false)

  React.useEffect(() => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!key) return // we'll render Leaflet fallback below
    if (!ready) return
    const google = window.google
    const center = { lat: value?.lat || 40.7128, lng: value?.lng || -74.006 }
    const map = new google.maps.Map(mapRef.current, { center, zoom: 13, mapTypeControl: false })
    mapObjRef.current = map
    markerRef.current = new google.maps.Marker({ map, position: center, draggable: true })

    const ac = new google.maps.places.Autocomplete(inputRef.current, { fields: [ 'formatted_address', 'geometry', 'address_components' ] })
    ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      if (!place.geometry) return
      const pos = place.geometry.location
      map.setCenter(pos)
      markerRef.current.setPosition(pos)
      const { address, zip } = extractAddress(place)
      inputRef.current.value = address
      if (zipRef.current) zipRef.current.value = zip || ''
      onChange?.({ lat: pos.lat(), lng: pos.lng(), address, zip })
    })

    const geocoder = new google.maps.Geocoder()
    markerRef.current.addListener('dragend', () => {
      const pos = markerRef.current.getPosition()
      geocoder.geocode({ location: pos }, (results) => {
        const best = results?.[0]
        const { address, zip } = extractAddress(best)
        inputRef.current.value = address || inputRef.current.value
        if (zipRef.current) zipRef.current.value = zip || zipRef.current.value
        onChange?.({ lat: pos.lat(), lng: pos.lng(), address, zip })
      })
    })
  }, [ready])

  // If no Google key, render a Leaflet-based picker that uses OpenStreetMap + Nominatim
  return (
    <div className="map-picker">
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Approximate Location</label>
          <div style={{ position: 'relative' }}>
            <input 
              ref={inputRef} 
              placeholder="Search address or move marker"
              defaultValue={value?.address || ''}
              onFocus={()=>setShowSug(true)}
              onBlur={()=>setTimeout(()=>setShowSug(false), 150)}
              onChange={e=>{
                const q = e.currentTarget.value
                if (!q || q.length < 3) { setOsmSuggestions([]); return }
                setOsmLoading(true)
                // debounce manually
                clearTimeout((window)._osmT)
                ;(window)._osmT = setTimeout(async ()=>{
                  try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=5`)
                    const data = await res.json()
                    setOsmSuggestions(data || [])
                  } finally { setOsmLoading(false) }
                }, 350)
              }}
            />
            {showSug && (osmLoading || osmSuggestions.length > 0) && (
              <div className="suggestions">
                {osmLoading && <div className="suggestion">Searching...</div>}
                {!osmLoading && osmSuggestions.map((s, i)=> (
                  <div key={i} className="suggestion" onMouseDown={()=>{
                    const lat = parseFloat(s.lat), lng = parseFloat(s.lon)
                    initLeaflet(mapRef, inputRef, zipRef, { lat, lng }, onChange)
                    const zip = s.address?.postcode || ''
                    if (zipRef.current) zipRef.current.value = zip
                    if (inputRef.current) inputRef.current.value = s.display_name
                    onChange?.({ lat, lng, address: s.display_name, zip })
                    setOsmSuggestions([])
                  }}>
                    {s.display_name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Zip Code</label>
          <input ref={zipRef} placeholder="Zip" defaultValue={value?.zip || ''} />
        </div>
      </div>
      <div ref={mapRef} className="map-canvas" />
      {(!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) && (
        <div className="text-sm" style={{ color: 'var(--text-muted)', marginTop: '.5rem' }}>
          Using free OpenStreetMap. Press Enter to search, or drag the marker.
        </div>
      )}
    </div>
  )
}

function extractAddress(place) {
  if (!place) return { address: '', zip: '' }
  const address = place.formatted_address || ''
  let zip = ''
  const comps = place.address_components || []
  for (const c of comps) if (c.types?.includes('postal_code')) { zip = c.long_name; break }
  return { address, zip }
}

// Leaflet fallback initializer
function initLeaflet(mapRef, inputRef, zipRef, center, onChange) {
  // Lazy-load Leaflet only when needed
  import('leaflet').then(L => {
    const leaflet = L.default || L
    const map = leaflet.map(mapRef.current).setView([center?.lat || 40.7128, center?.lng || -74.006], 13)
    leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map)
    const marker = leaflet.marker([center?.lat || 40.7128, center?.lng || -74.006], { draggable: true }).addTo(map)
    const geocode = async (lat, lng) => {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`)
      const data = await res.json()
      const address = data?.display_name || ''
      const zip = data?.address?.postcode || ''
      if (inputRef.current) inputRef.current.value = address
      if (zipRef.current) zipRef.current.value = zip
      onChange?.({ lat, lng, address, zip })
    }
    map.on('click', e => { marker.setLatLng(e.latlng); geocode(e.latlng.lat, e.latlng.lng) })
    marker.on('dragend', () => { const { lat, lng } = marker.getLatLng(); geocode(lat, lng) })
    // Initialize with center
    geocode(center?.lat || 40.7128, center?.lng || -74.006)
  })
}


// Simple SVG icons
const SearchIcon = () => (
  <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
)

const LocationIcon = () => (
  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>
)

const CalendarIcon = () => (
  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
  </svg>
)

const UserIcon = () => (
  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
)

const LogoutIcon = () => (
  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
  </svg>
)

const BellIcon = () => (
  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
  </svg>
)

const PlusIcon = () => (
  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
  </svg>
)

const AdminIcon = () => (
  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
  </svg>
)

const StatsIcon = () => (
  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
  </svg>
)

const UsersIcon = () => (
  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
    <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.54 8H17c-.8 0-1.54.37-2.01.99L12 11l-2.99-2.01A2.5 2.5 0 0 0 7 8H5.46c-.8 0-1.54.37-2.01.99L1 13.5V22h2v-6h2.5l2.54 7.63A1.5 1.5 0 0 0 9.46 24H11c.8 0 1.54-.37 2.01-.99L16 19l2.99 2.01A2.5 2.5 0 0 0 21 24h1.54c.8 0 1.54-.37 2.01-.99L27 16.5V22h2v-6h-2.5z"/>
  </svg>
)

const SettingsIcon = () => (
  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
  </svg>
)

function Layout({ children }) {
  const { isAdmin, user } = useAuth()
  
  // Debug: Log user info to console
  console.log('User:', user)
  console.log('Is Admin:', isAdmin)
  
  return (
    <div className="app-container">
      <header className="header">
        <nav className="nav">
          <Link to="/" className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🔍</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Lost & Found</span>
          </Link>
          <ul className="nav-links">
            <li><Link to="/submit/lost" className="nav-link">Submit Lost Item</Link></li>
            <li><Link to="/submit/found" className="nav-link">Submit Found Item</Link></li>
            <li><Link to="/recent" className="nav-link">View Recent Posts</Link></li>
            <li><Link to="/profile" className="nav-link">Profile</Link></li>
            {isAdmin && (
              <li>
                <Link to="/admin" className="nav-admin-btn">🔧 Admin</Link>
              </li>
            )}
          </ul>
          <AuthNav />
        </nav>
      </header>
      <main className="main-content">
        <div className="container">
          {children}
        </div>
      </main>
    </div>
  )
}

function AuthNav() {
  const { isAuthed, user, setToken, setUser } = useAuth()
  const [notifications, setNotifications] = React.useState([])
  const [unreadCount, setUnreadCount] = React.useState(0)

  React.useEffect(() => {
    if (isAuthed) {
      loadNotifications()
    }
  }, [isAuthed])

  async function loadNotifications() {
    try {
      const data = await api.getNotifications()
      setNotifications(data.notifications || [])
      setUnreadCount((data.notifications || []).filter(n => !n.read).length)
    } catch (error) {
      console.error('Failed to load notifications:', error)
    }
  }

  if (!isAuthed) {
    return (

<div className="nav-auth">
        <Link to="/login" className="btn-outline">Login</Link>
        <Link to="/register" className="btn-primary">Register</Link>
      </div>
    )
  }
  return (
    <div className="nav-auth">
      <Link to="/notifications" className="nav-link" style={{ position: 'relative' }}>
        <BellIcon />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            background: '#ef4444',
            color: 'white',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
        <UserIcon />
        <span>Hi, {user?.name || user?.email}</span>
      </div>
      <button 
        className="btn-secondary" 
        onClick={() => { setToken(''); setUser(null) }}
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
      >
        <LogoutIcon />
        Logout
      </button>
    </div>
  )
}

function BrowsePage() {
  const [items, setItems] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [q, setQ] = React.useState('')
  const [location, setLocation] = React.useState('')
  const [type, setType] = React.useState('')
  
  async function load() {
    setLoading(true)
    try {
      const data = await api.browse({ q, location, type })
      setItems(data)
    } catch (error) {
      console.error('Failed to load items:', error)
    } finally {
      setLoading(false)
    }
  }
  
  React.useEffect(() => { load() }, [])
  
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Find Lost & Found Items</h1>
        <p className="page-subtitle">Search through lost and found items in your area</p>
      </div>
      
      <div className="search-form">
        <form onSubmit={(e)=>{e.preventDefault(); load()}} className="search-form-grid">
          <div className="search-input">
            <SearchIcon />
            <input 
              value={q} 
              onChange={e=>setQ(e.target.value)} 
              placeholder="Search by item name or description..." 
            />
          </div>
          <input 
            value={location} 
            onChange={e=>setLocation(e.target.value)} 
            placeholder="Location (e.g., Library, Park)" 
          />
          <select value={type} onChange={e=>setType(e.target.value)}>
            <option value="">All Items</option>
            <option value="lost">Lost Items</option>
            <option value="found">Found Items</option>
          </select>
          <button type="submit" className="btn-primary">Search</button>
        </form>
      </div>
      
      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          Loading items...
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3 className="empty-state-title">No items found</h3>
          <p className="empty-state-description">
            Try adjusting your search criteria or check back later for new items.
          </p>
        </div>
      ) : (
        <div className="items-grid">
          {items.map(it => (
            <div key={it._id} className="item-card">
              {it.imageBase64 && (
                <img src={it.imageBase64} alt={it.name} className="item-image" />
              )}
              <div className="item-content">
                <div className="item-header">
                  <h3 className="item-title">{it.name}</h3>
                  <span className={`item-type ${it.type}`}>{it.type}</span>
                </div>
                <div className="item-meta">
                  <div className="item-location">
                    <LocationIcon />
                    <span>{it.location}</span>
                  </div>
                  <div className="item-date">
                    <CalendarIcon />
                    <span>{new Date(it.date).toLocaleDateString()}</span>
                  </div>
                </div>
                {it.description && (
                  <p className="item-description">{it.description}</p>
                )}
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`status-badge ${it.isResolved ? 'status-resolved' : 'status-open'}`}>
                    {it.isResolved ? 'Resolved' : 'Open'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RecentPostsPage() {
  const { isAdmin } = useAuth()
  const [items, setItems] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  
  async function load() {
    setLoading(true)
    try {
      const data = await api.browse({})
      // Filter items based on user role
      let filteredItems = data || []
      
      if (!isAdmin) {
        // Regular users see only lost items
        filteredItems = filteredItems.filter(item => item.type === 'lost')
      }
      // Admins see both lost and found items (no filtering)
      
      // Sort by most recent first and limit to 50
      filteredItems = filteredItems
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 50)
      
      setItems(filteredItems)
    } catch (error) {
      console.error('Failed to load recent items:', error)
    } finally {
      setLoading(false)
    }
  }
  
  React.useEffect(() => { load() }, [isAdmin])
  
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Recent Posts</h1>
        <p className="page-subtitle">
          {isAdmin 
            ? "Latest lost and found items reported in the system" 
            : "Recent lost items - help others find their belongings"
          }
        </p>
      </div>
      
      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          Loading recent posts...
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <h3 className="empty-state-title">No recent posts</h3>
          <p className="empty-state-description">
            {isAdmin 
              ? "No items have been reported yet." 
              : "No lost items have been reported recently."
            }
          </p>
        </div>
      ) : (
        <div className="items-grid">
          {items.map(it => (
            <div key={it._id} className="item-card">
              {it.imageBase64 && (
                <img src={it.imageBase64} alt={it.name} className="item-image" />
              )}
              <div className="item-content">
                <div className="item-header">
                  <h3 className="item-title">{it.name}</h3>
                  <span className={`item-type ${it.type}`}>{it.type}</span>
                </div>
                <div className="item-meta">
                  <div className="item-location">
                    <LocationIcon />
                    <span>{it.location}</span>
                  </div>
                  <div className="item-date">
                    <CalendarIcon />
                    <span>{new Date(it.date).toLocaleDateString()}</span>
                  </div>
                </div>
                {it.description && (
                  <p className="item-description">{it.description}</p>
                )}
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`status-badge ${it.isResolved ? 'status-resolved' : 'status-open'}`}>
                    {it.isResolved ? 'Resolved' : 'Open'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SubmitItemPage({ defaultType = 'lost', title = 'Submit Item' }) {
  const { isAuthed } = useAuth()
  const [submitting, setSubmitting] = React.useState(false)
  const [mapState, setMapState] = React.useState({ lat: null, lng: null, address: '', zip: '' })
  
  if (!isAuthed) return <Navigate to="/login" replace />
  
  async function onSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const form = new FormData(e.currentTarget)
      const extraPieces = [
        form.get('category') && `Category: ${form.get('category')}`,
        form.get('brand') && `Brand: ${form.get('brand')}`,
        form.get('primaryColor') && `Primary Color: ${form.get('primaryColor')}`,
        form.get('secondaryColor') && `Secondary Color: ${form.get('secondaryColor')}`,
        form.get('time') && `Time: ${form.get('time')}`,
        form.get('whereLost') && `Where: ${form.get('whereLost')}`,
        form.get('zip') && `Zip: ${form.get('zip')}`,
        (mapState.lat && mapState.lng) && `LatLng: ${mapState.lat},${mapState.lng}`,
      ].filter(Boolean)

      const composedDescription = [form.get('description') || '', extraPieces.join(' | ')].filter(Boolean).join('\n')

      const date = form.get('date')
      const time = form.get('time') || '00:00'
      const isoDate = new Date(`${date}T${time}`).toISOString()

      const location = [mapState.address || form.get('location') || '', (mapState.zip || form.get('zip')) ? `(${mapState.zip || form.get('zip')})` : ''].filter(Boolean).join(' ')

      const body = {
        type: form.get('type'),
        name: form.get('name'),
        category: form.get('category'),
        description: composedDescription,
        location,
        date: isoDate,
        imageBase64: await fileToBase64(form.get('image')),
        email: form.get('email'),
        mobileNumber: form.get('mobileNumber'),
      }
      await api.createItem(body)
      window.location.assign('/mine')
    } catch (error) {
      console.error('Failed to create item:', error)
      const errorMessage = error.message || 'Failed to create item. Please try again.'
      alert(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }
  
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">Our matching system helps connect lost and found items</p>
      </div>
      
      <div className="form-container">
        <form onSubmit={onSubmit}>
          <h2 className="form-title">Item Details</h2>
          
          <div className="form-group">
            <label className="form-label">Item Type</label>
            <select name="type" required defaultValue={defaultType}>
              <option value="lost">Lost Item</option>
              <option value="found">Found Item</option>
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">What was {defaultType === 'lost' ? 'Lost' : 'Found'} *</label>
            <input name="name" placeholder="e.g., Smartphone, Wallet, Jacket" required />
          </div>
          
          <div className="form-group">
            <label className="form-label">Category *</label>
            <input name="category" placeholder="Animals/Pets, Clothing, Electronics, Accessories, etc." required />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input 
                name="email" 
                type="email" 
                placeholder="Enter your email" 
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <input 
                name="mobileNumber" 
                type="tel" 
                placeholder="Enter your mobile number (e.g., +1234567890)" 
                required 
              />
            </div>
          </div>
          <small style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem', display: 'block' }}>
            Contact information is required for reporting lost or found items
          </small>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Brand</label>
              <input name="brand" placeholder="e.g., Apple, Samsung, Nike" />
            </div>
            <div className="form-group">
              <label className="form-label">Primary Color</label>
              <input name="primaryColor" placeholder="e.g., Black, Red, Blue" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Secondary Item Color</label>
              <input name="secondaryColor" placeholder="Optional" />
            </div>
            <div className="form-group">
              <label className="form-label">{defaultType === 'lost' ? 'Date Lost' : 'Date Found'}</label>
              <input name="date" type="date" required />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{defaultType === 'lost' ? 'Time Lost' : 'Time Found'}</label>
              <input name="time" type="time" />
            </div>
            <div className="form-group">
              <label className="form-label">{defaultType === 'lost' ? 'Where Lost' : 'Where Found'}</label>
              <select name="whereLost" defaultValue="">
                <option value="">Select Type</option>
                <option value="Bar">Bar</option>
                <option value="Restaurant">Restaurant</option>
                <option value="Park">Park</option>
                <option value="Transit">Transit</option>
                <option value="School">School</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">Additional Information</label>
            <textarea 
              name="description" 
              placeholder="Provide any additional details/description of your property..." 
              rows={4} 
            />
          </div>
          
          <input type="hidden" name="zip" value={mapState.zip || ''} readOnly />
          <input type="hidden" name="location" value={mapState.address || ''} readOnly />

          <MapPicker value={mapState} onChange={setMapState} />

          <div className="form-group">
            <label className="form-label">Photo (Optional)</label>
            <input name="image" type="file" accept="image/*" />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem', display: 'block' }}>
              Upload a photo to help others identify the item
            </small>
          </div>

          <button type="submit" className="btn-primary" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? (
              <>
                <div className="spinner"></div>
                Submitting...
              </>
            ) : (
              <>
                <PlusIcon />
                Submit {defaultType === 'lost' ? 'Lost' : 'Found'} Item
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

function MatchesPage() {
  const { isAuthed } = useAuth()
  const [matches, setMatches] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const { isAdmin } = useAuth()
  
  React.useEffect(() => { 
    if (isAuthed) {
      setLoading(true)
      api.myMatches()
        .then(setMatches)
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [isAuthed])
  
  if (!isAuthed) return <Navigate to="/login" replace />
  
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">My Matches</h1>
        <p className="page-subtitle">Potential matches between your lost and found items</p>
      </div>
      
      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          Loading matches...
        </div>
      ) : matches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔗</div>
          <h3 className="empty-state-title">No matches found</h3>
          <p className="empty-state-description">
            We'll notify you when we find potential matches for your items.
          </p>
        </div>
      ) : (
        <div className="items-grid">
          {matches.map(m => (
            <div key={m._id} className="item-card">
              <div className="item-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 className="item-title">Potential Match</h3>
                  <span className={`status-badge status-pending`}>{m.status}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <MatchItem item={m.itemAId} />
                  <MatchItem item={m.itemBId} />
                </div>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    {m.status === 'pending' && (
                      <>
                        <button className="btn-primary" onClick={()=> api.admin.updateMatchStatus(m._id, { status: 'confirmed' }).then(()=> api.myMatches().then(setMatches))}>Confirm Match</button>
                        <button className="btn-danger" onClick={()=> api.admin.updateMatchStatus(m._id, { status: 'rejected' }).then(()=> api.myMatches().then(setMatches))}>Reject</button>
                      </>
                    )}
                    {m.status === 'confirmed' && (
                      <button className="btn-primary" onClick={()=> api.admin.updateMatchStatus(m._id, { status: 'resolved' }).then(()=> api.myMatches().then(setMatches))}>Mark Resolved</button>
                    )}
                    <Link to={`/admin/matches/${m._id}`} className="btn-secondary">Details</Link>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MinePage() {
  const { isAuthed } = useAuth()
  const [items, setItems] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  
  React.useEffect(() => { 
    if (isAuthed) {
      setLoading(true)
      api.myItems()
        .then(setItems)
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [isAuthed])
  
  if (!isAuthed) return <Navigate to="/login" replace />
  
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">My Reports</h1>
        <p className="page-subtitle">Manage your lost and found item reports</p>
      </div>
      
      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          Loading your reports...
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <h3 className="empty-state-title">No reports yet</h3>
          <p className="empty-state-description">
            Start by reporting a lost or found item to help others.
          </p>
          <Link to="/report" className="btn-primary">Report an Item</Link>
        </div>
      ) : (
        <div className="items-grid">
          {items.map(it => (
            <div key={it._id} className="item-card">
              <div className="item-content">
                <div className="item-header">
                  <h3 className="item-title">{it.name}</h3>
                  <span className={`item-type ${it.type}`}>{it.type}</span>
                </div>
                <div className="item-meta">
                  <div className="item-location">
                    <LocationIcon />
                    <span>{it.location}</span>
                  </div>
                  <div className="item-date">
                    <CalendarIcon />
                    <span>{new Date(it.date).toLocaleDateString()}</span>
                  </div>
                </div>
                {it.description && (
                  <p className="item-description">{it.description}</p>
                )}
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`status-badge ${it.isResolved ? 'status-resolved' : 'status-open'}`}>
                    {it.isResolved ? 'Resolved' : 'Open'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MatchItem({ item }) {
  if (!item) return null
  return (
    <div style={{ 
      border: '1px solid var(--border-color)', 
      padding: '1rem', 
      borderRadius: 'var(--radius-md)', 
      background: 'var(--bg-secondary)'
    }}>
      <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
        {item.name} 
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
          ({item.type})
        </span>
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        {item.location} • {new Date(item.date).toLocaleDateString()}
      </div>
    </div>
  )
}

async function fileToBase64(file) {
  if (!file || typeof file === 'string') return ''
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function LoginPage() {
  const { setToken, setUser } = useAuth()
  const [loading, setLoading] = React.useState(false)
  
  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const form = new FormData(e.currentTarget)
      const email = form.get('email')
      const password = form.get('password')
      const { token, user } = await api.login({ email, password })
      setToken(token)
      setUser(user)
      window.location.assign('/')
    } catch (error) {
      console.error('Login failed:', error)
      alert('Login failed. Please check your credentials and try again.')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Welcome Back</h1>
        <p className="page-subtitle">Sign in to your account to continue</p>
      </div>
      
      <div className="login-hero" data-bg style={{ ['--login-bg-image']: 'url(\"https://t4.ftcdn.net/jpg/11/35/37/61/240_F_1135376117_C3zCMB5tMxUsz2rOQzEOITEVG6IG5LRP.jpg\")' }}>
        <div className="form-container">
        <form onSubmit={onSubmit}>
          <h2 className="form-title">Sign In</h2>
          
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              name="email" 
              type="email" 
              placeholder="Enter your email" 
              required 
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              name="password" 
              type="password" 
              placeholder="Enter your password" 
              required 
            />
          </div>
          
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? (
              <>
                <div className="spinner"></div>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
          
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Don't have an account? </span>
            <Link to="/register">Sign up here</Link>
          </div>
        </form>
        </div>
      </div>
    </div>
  )
}

function RegisterPage() {
  const { setToken, setUser } = useAuth()
  const [loading, setLoading] = React.useState(false)
  
  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const form = new FormData(e.currentTarget)
      const name = form.get('name')
      const email = form.get('email')
      const mobileNumber = form.get('mobileNumber')
      const password = form.get('password')
      const { token, user } = await api.register({ name, email, mobileNumber, password })
      setToken(token)
      setUser(user)
      window.location.assign('/')
    } catch (error) {
      console.error('Registration failed:', error)
      alert('Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Join Lost & Found</h1>
        <p className="page-subtitle">Create your account to start helping others</p>
      </div>
      
      <div className="form-container">
        <form onSubmit={onSubmit}>
          <h2 className="form-title">Create Account</h2>
          <div style={{ 
            padding: '1rem', 
            backgroundColor: 'var(--info-bg, #e3f2fd)', 
            border: '1px solid var(--info-border, #2196f3)', 
            borderRadius: 'var(--radius-md)', 
            marginBottom: '1.5rem',
            color: 'var(--info-color, #1976d2)'
          }}>
            <strong>📞 Contact Information:</strong> Your email and mobile number are required for reporting lost and found items. 
            This information helps others contact you when matches are found.
          </div>
          
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input 
              name="name" 
              placeholder="Enter your full name" 
              required 
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input 
                name="email" 
                type="email" 
                placeholder="Enter your email" 
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <input 
                name="mobileNumber" 
                type="tel" 
                placeholder="Enter your mobile number (e.g., +1234567890)" 
                required 
              />
            </div>
          </div>
          <small style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem', display: 'block' }}>
            Contact information is required for reporting lost or found items
          </small>
          
          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              name="password" 
              type="password" 
              placeholder="Create a password" 
              required 
            />
          </div>
          
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? (
              <>
                <div className="spinner"></div>
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
          
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Already have an account? </span>
            <Link to="/login">Sign in here</Link>
          </div>
        </form>
      </div>
    </div>
  )
}

// Admin Dashboard Component
function AdminDashboard() {
  const { isAdmin } = useAuth()
  const [stats, setStats] = React.useState(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (isAdmin) {
      loadStats()
    }
  }, [isAdmin])

  async function loadStats() {
    try {
      const data = await api.admin.getStats()
      setStats(data)
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) return <Navigate to="/" replace />

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading admin dashboard...
      </div>
    )
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <img 
            src="https://th.bing.com/th/id/OIP.mkiafkv2eMuVsyjnZ4aB1gHaHa?w=208&h=208&c=7&r=0&o=7&cb=12&dpr=1.3&pid=1.7&rm=3" 
            alt="Lost & Found Logo" 
            style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '8px',
              objectFit: 'cover'
            }} 
          />
          <span style={{ marginLeft: '0.75rem', fontSize: '1.1rem', fontWeight: '600' }}>Lost & Found</span>
        </div>
        <nav className="admin-nav">
          <Link to="/admin" className="admin-link active">Dashboard</Link>
          <Link to="/admin/items" className="admin-link">Manage items</Link>
          <Link to="/admin/matches" className="admin-link">Matches</Link>
          <Link to="/admin/users" className="admin-link">Users</Link>
        </nav>
      </aside>
      <section className="admin-main">
        <div className="admin-header">
          <div>
            <div className="admin-title">Dashboard</div>
            <div className="admin-subtitle">Manage lost and found items and matches</div>
          </div>
          <div style={{ background:'#e2e8f0', width:36, height:36, borderRadius:999 }} />
        </div>

        <div className="stat-grid">
          <div className="stat-card"><div className="stat-label">Total Items</div><div className="stat-value">{stats?.items.total || 0}</div></div>
          <div className="stat-card"><div className="stat-label">Resolved</div><div className="stat-value" style={{ color: 'var(--admin-success)' }}>{stats?.items.resolved || 0}</div></div>
          <div className="stat-card"><div className="stat-label">Pending Matches</div><div className="stat-value" style={{ color: 'var(--admin-warning)' }}>{stats?.matches.pending || 0}</div></div>
          <div className="stat-card"><div className="stat-label">Users</div><div className="stat-value">{stats?.users.total || 0}</div></div>
        </div>


        <div className="admin-actions">
          <Link to="/admin/items" className="admin-action-btn">Manage Items</Link>
          <Link to="/admin/matches" className="admin-action-btn">Manage Matches</Link>
          <Link to="/admin/users" className="admin-action-btn">Manage Users</Link>
        </div>
      </section>
    </div>
  )
}

// Admin Items Management
function AdminItemsPage() {
  const { isAdmin } = useAuth()
  const [items, setItems] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [filters, setFilters] = React.useState({ type: '', status: '', search: '' })

  React.useEffect(() => {
    if (isAdmin) {
      loadItems()
    }
  }, [isAdmin, filters])

  async function loadItems() {
    setLoading(true)
    try {
      const data = await api.admin.getItems(filters)
      setItems(data.items || [])
    } catch (error) {
      console.error('Failed to load items:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateItemStatus(itemId, isResolved) {
    try {
      await api.admin.updateItemStatus(itemId, { isResolved })
      loadItems() // Reload items
    } catch (error) {
      console.error('Failed to update item status:', error)
      alert('Failed to update item status')
    }
  }

  async function deleteItem(itemId) {
    if (!confirm('Are you sure you want to delete this item?')) return
    
    try {
      await api.admin.deleteItem(itemId)
      loadItems() // Reload items
    } catch (error) {
      console.error('Failed to delete item:', error)
      alert('Failed to delete item')
    }
  }

  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Manage Items</h1>
        <p className="page-subtitle">View and manage all lost and found items</p>
      </div>

      <div className="search-form">
        <div className="search-form-grid">
          <input 
            value={filters.search} 
            onChange={e => setFilters({...filters, search: e.target.value})} 
            placeholder="Search items..." 
          />
          <select value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})}>
            <option value="">All Types</option>
            <option value="lost">Lost Items</option>
            <option value="found">Found Items</option>
          </select>
          <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          Loading items...
        </div>
      ) : (
        <div className="items-grid">
          {items.map(item => (
            <div key={item._id} className="item-card">
              {item.imageBase64 && (
                <img src={item.imageBase64} alt={item.name} className="item-image" />
              )}
              <div className="item-content">
                <div className="item-header">
                  <h3 className="item-title">{item.name}</h3>
                  <span className={`item-type ${item.type}`}>{item.type}</span>
                </div>
                <div className="item-meta">
                  <div className="item-location">
                    <LocationIcon />
                    <span>{item.location}</span>
                  </div>
                  <div className="item-date">
                    <CalendarIcon />
                    <span>{new Date(item.date).toLocaleDateString()}</span>
                  </div>
                </div>
                {item.description && (
                  <p className="item-description">{item.description}</p>
                )}
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`status-badge ${item.isResolved ? 'status-resolved' : 'status-open'}`}>
                    {item.isResolved ? 'Resolved' : 'Open'}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="btn-secondary" 
                      onClick={() => updateItemStatus(item._id, !item.isResolved)}
                    >
                      {item.isResolved ? 'Reopen' : 'Resolve'}
                    </button>
                    <Link to={`/admin/items/${item._id}`} className="btn-primary">Details</Link>
                    <button 
                      className="btn-danger" 
                      onClick={() => deleteItem(item._id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  By: {item.userId?.name || 'Unknown'} ({item.userId?.email || 'No email'})
                  {item.userId?.mobileNumber && (
                    <div style={{ marginTop: '0.25rem' }}>
                      📱 {item.userId.mobileNumber}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Admin Matches Management
function AdminMatchesPage() {
  const { isAdmin } = useAuth()
  const [matches, setMatches] = React.useState([])
  const [recentItems, setRecentItems] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [filters, setFilters] = React.useState({ status: '' })
  const [newA, setNewA] = React.useState('')
  const [newB, setNewB] = React.useState('')
  const [newNotes, setNewNotes] = React.useState('')
  const [creating, setCreating] = React.useState(false)
  const [actionModal, setActionModal] = React.useState({ open: false, match: null, notes: '' })
  const [emailModal, setEmailModal] = React.useState({ open: false, match: null, message: '', sending: false })

  React.useEffect(() => {
    if (isAdmin) {
      loadMatches()
      loadRecentItems()
    }
  }, [isAdmin, filters])

  async function loadMatches() {
    setLoading(true)
    try {
      const data = await api.admin.getMatches(filters)
      setMatches(data.matches || [])
    } catch (error) {
      console.error('Failed to load matches:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadRecentItems() {
    try {
      const data = await api.browse({})
      // Get recent items (last 50) that are not resolved
      const recent = (data || [])
        .filter(item => !item.isResolved)
        .slice(0, 50)
      setRecentItems(recent)
    } catch (error) {
      console.error('Failed to load recent items:', error)
    }
  }

  async function updateMatchStatus(matchId, status, adminNotes) {
    try {
      await api.admin.updateMatchStatus(matchId, { status, adminNotes })
      loadMatches() // Reload matches
    } catch (error) {
      console.error('Failed to update match status:', error)
      alert('Failed to update match status')
    }
  }

  async function sendEmailToOwners(match) {
    setEmailModal({ open: true, match, message: '', sending: false })
  }

  async function handleSendEmail() {
    if (!emailModal.message.trim()) {
      alert('Please enter a message')
      return
    }
    
    setEmailModal(prev => ({ ...prev, sending: true }))
    
    // Add timeout to prevent stuck modal
    const timeoutId = setTimeout(() => {
      setEmailModal(prev => ({ ...prev, sending: false }))
      alert('Request timed out. Please try again.')
    }, 10000) // 10 second timeout
    window.emailTimeout = timeoutId
    
    try {
      const result = await api.admin.sendMatchEmail(emailModal.match._id, {
        customMessage: emailModal.message
      })
      
      if (result.success) {
        if (result.emailsSent > 0) {
          alert(`Email sent successfully to ${result.emailsSent} out of ${result.totalEmails} recipients`)
        } else {
          alert('Email service is not configured. In-app notifications have been created instead.')
        }
        setEmailModal({ open: false, match: null, message: '', sending: false })
      } else {
        alert('Failed to send email. In-app notifications have been created instead.')
        setEmailModal({ open: false, match: null, message: '', sending: false })
      }
    } catch (error) {
      console.error('Failed to send email:', error)
      const errorMessage = error.message || 'Unknown error'
      if (errorMessage.includes('not configured')) {
        alert('Email service is not configured. In-app notifications have been created instead.')
      } else {
        alert('Failed to send email: ' + errorMessage + '. In-app notifications have been created instead.')
      }
      setEmailModal({ open: false, match: null, message: '', sending: false })
    } finally {
      clearTimeout(timeoutId)
      window.emailTimeout = null
      setEmailModal(prev => ({ ...prev, sending: false }))
    }
  }


  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Manage Matches</h1>
        <p className="page-subtitle">Review, confirm, and resolve item matches</p>
      </div>

      <div className="search-form">
        <div className="search-form-grid">
          <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="rejected">Rejected</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Create Match from Recent Reports</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Select two items from recent reports to create a potential match
        </p>
        
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Select First Item</label>
            <select value={newA} onChange={e=>setNewA(e.target.value)}>
              <option value="">Choose an item...</option>
              {recentItems.map(item => (
                <option key={item._id} value={item._id}>
                  {item.name} ({item.type}) - {item.location}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Select Second Item</label>
            <select value={newB} onChange={e=>setNewB(e.target.value)}>
              <option value="">Choose an item...</option>
              {recentItems.map(item => (
                <option key={item._id} value={item._id}>
                  {item.name} ({item.type}) - {item.location}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="form-group">
          <label className="form-label">Match Notes</label>
          <textarea 
            value={newNotes} 
            onChange={e=>setNewNotes(e.target.value)} 
            placeholder="Explain why these items might be a match..." 
            rows={3}
          />
        </div>
        
        <button className="btn-primary" disabled={creating || !newA || !newB} onClick={async()=>{
          try {
            setCreating(true)
            await api.admin.createMatch({ itemAId: newA.trim(), itemBId: newB.trim(), notes: newNotes.trim() })
            setNewA(''); setNewB(''); setNewNotes('')
            await loadMatches()
            await loadRecentItems() // Refresh recent items
          } catch (err) {
            console.error(err); alert(err?.message || 'Failed to create match')
          } finally { setCreating(false) }
        }}>{creating ? 'Creating Match...' : 'Create Match'}</button>
      </div>


      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          Loading matches...
        </div>
      ) : matches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔗</div>
          <h3 className="empty-state-title">No matches yet</h3>
          <p className="empty-state-description">Create a match above to get started, then confirm or resolve.</p>
        </div>
      ) : (
        <div className="items-grid">
          {matches.map(match => (
            <div key={match._id} className="item-card">
              <div className="item-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 className="item-title">Match #{match._id.slice(-6)}</h3>
                  <span className={`status-badge status-${match.status}`}>{match.status}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <MatchItem item={match.itemAId} />
                  <MatchItem item={match.itemBId} />
                </div>
                {match.notes && (
                  <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                    <strong>Notes:</strong> {match.notes}
                  </div>
                )}
                {match.adminNotes && (
                  <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                    <strong>Admin Notes:</strong> {match.adminNotes}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button className="btn-secondary" onClick={()=> setActionModal({ open:true, match, notes: match.adminNotes || '' })}>Manage</button>
                  <button className="btn-primary" onClick={()=> sendEmailToOwners(match)}>📧 Send Email</button>
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Created: {new Date(match.createdAt).toLocaleDateString()}
                  {match.resolvedBy && (<span> • Resolved by: {match.resolvedBy.name}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {actionModal.open && (
        <div className="modal-backdrop" onClick={()=> setActionModal({ open:false, match:null, notes:'' })}>
          <div className="modal-card" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Manage Match</div>
              <button className="btn-secondary" onClick={()=> setActionModal({ open:false, match:null, notes:'' })}>Close</button>
            </div>
            <div style={{ marginBottom: '.75rem' }}>
              <div className={`status-badge status-${actionModal.match.status}`}>Current: {actionModal.match.status}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Admin Notes</label>
              <textarea rows={4} value={actionModal.notes} onChange={e=> setActionModal(s=>({ ...s, notes: e.target.value }))} />
            </div>
            <div className="modal-actions">
              {actionModal.match.status === 'pending' && (
                <>
                  <button className="btn-primary" onClick={()=> { updateMatchStatus(actionModal.match._id, 'confirmed', actionModal.notes); setActionModal({ open:false, match:null, notes:'' }) }}>✅ Confirm</button>
                  <button className="btn-danger" onClick={()=> { updateMatchStatus(actionModal.match._id, 'rejected', actionModal.notes); setActionModal({ open:false, match:null, notes:'' }) }}>✖ Reject</button>
                </>
              )}
              {actionModal.match.status === 'confirmed' && (
                <button className="btn-primary" onClick={()=> { updateMatchStatus(actionModal.match._id, 'resolved', actionModal.notes); setActionModal({ open:false, match:null, notes:'' }) }}>🎉 Mark Resolved</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {emailModal.open && (
        <div className="modal-backdrop" onClick={()=> setEmailModal({ open:false, match:null, message:'', sending:false })}>
          <div className="modal-card" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">📧 Send Email to Match Owners</div>
              <button className="btn-secondary" onClick={()=> setEmailModal({ open:false, match:null, message:'', sending:false })}>Close</button>
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>Match Details:</h4>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                <p><strong>Status:</strong> {emailModal.match.status}</p>
                <p><strong>Created:</strong> {new Date(emailModal.match.createdAt).toLocaleDateString()}</p>
                {emailModal.match.notes && <p><strong>Notes:</strong> {emailModal.match.notes}</p>}
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Custom Message</label>
              <textarea 
                rows={6} 
                value={emailModal.message} 
                onChange={e=> setEmailModal(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Enter your custom message to the match owners. This will be included in the email along with match details."
                style={{ width: '100%', resize: 'vertical' }}
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                This message will be sent to both item owners via email and also create in-app notifications.
                <br />
                <strong>Note:</strong> If email is not configured, in-app notifications will be created instead.
              </small>
            </div>
            
            <div className="modal-actions">
              <button 
                className="btn-primary" 
                onClick={handleSendEmail}
                disabled={emailModal.sending || !emailModal.message.trim()}
              >
                {emailModal.sending ? (
                  <>
                    <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                    Sending Email...
                  </>
                ) : (
                  '📧 Send Email'
                )}
              </button>
              <button 
                className="btn-secondary" 
                onClick={()=> {
                  setEmailModal({ open:false, match:null, message:'', sending:false })
                  // Clear any pending timeouts
                  if (window.emailTimeout) {
                    clearTimeout(window.emailTimeout)
                    window.emailTimeout = null
                  }
                }}
                style={{ backgroundColor: emailModal.sending ? '#ef4444' : '', color: emailModal.sending ? 'white' : '' }}
              >
                {emailModal.sending ? 'Force Close' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// Item Details Page
function AdminItemDetailsPage() {
  const { isAdmin } = useAuth()
  const id = window.location.pathname.split('/').pop()
  const [item, setItem] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [modStatus, setModStatus] = React.useState('approved')
  const [modNotes, setModNotes] = React.useState('')

  React.useEffect(() => { if (isAdmin) load() }, [isAdmin])
  async function load() {
    setLoading(true)
    try {
      const data = await api.admin.getItem(id)
      setItem(data)
      setModStatus(data.moderationStatus || 'approved')
      setModNotes(data.moderationNotes || '')
    } finally { setLoading(false) }
  }

  async function moderate() {
    await api.admin.moderateItem(id, { moderationStatus: modStatus, moderationNotes: modNotes })
    await load()
  }

  async function toggleResolve() {
    await api.admin.updateItemStatus(id, { isResolved: !item.isResolved })
    await load()
  }

  async function del() {
    if (!confirm('Delete this item?')) return
    await api.admin.deleteItem(id)
    window.location.assign('/admin/items')
  }

  if (!isAdmin) return <Navigate to="/" replace />
  if (loading) return <div className="loading"><div className="spinner"></div>Loading item...</div>
  if (!item) return <div className="empty-state">Item not found</div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Item Details</h1>
        <p className="page-subtitle">View and manage this item</p>
      </div>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          {item.imageBase64 && <img src={item.imageBase64} alt={item.name} className="item-image" />}
          <div className="item-content">
            <div className="item-header">
              <h3 className="item-title">{item.name}</h3>
              <span className={`item-type ${item.type}`}>{item.type}</span>
            </div>
            <div className="item-meta">
              <div className="item-location"><LocationIcon /><span>{item.location}</span></div>
              <div className="item-date"><CalendarIcon /><span>{new Date(item.date).toLocaleDateString()}</span></div>
            </div>
            {item.description && <p className="item-description">{item.description}</p>}
            <div style={{ marginTop: '1rem' }}>
              <span className={`status-badge ${item.isResolved ? 'status-resolved' : 'status-open'}`}>{item.isResolved ? 'Resolved' : 'Open'}</span>
              <span className="status-badge" style={{ marginLeft: '.5rem' }}>{item.moderationStatus}</span>
            </div>
          </div>
        </div>
        <div>
          <div className="form-group">
            <label className="form-label">Moderation</label>
            <select value={modStatus} onChange={e=>setModStatus(e.target.value)}>
              <option value="approved">Approve</option>
              <option value="pending">Pending</option>
              <option value="rejected">Reject</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea value={modNotes} onChange={e=>setModNotes(e.target.value)} rows={4} />
          </div>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <button className="btn-primary" onClick={moderate}>Save Moderation</button>
            <button className="btn-secondary" onClick={toggleResolve}>{item.isResolved ? 'Reopen' : 'Mark Resolved'}</button>
            <button className="btn-danger" onClick={del}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Match Details Page
function AdminMatchDetailsPage() {
  const { isAdmin } = useAuth()
  const id = window.location.pathname.split('/').pop()
  const [match, setMatch] = React.useState(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => { if (isAdmin) load() }, [isAdmin])
  async function load() {
    setLoading(true)
    try { setMatch(await api.admin.getMatch(id)) } finally { setLoading(false) }
  }

  async function setStatus(status) {
    await api.admin.updateMatchStatus(id, { status })
    await load()
  }

  if (!isAdmin) return <Navigate to="/" replace />
  if (loading) return <div className="loading"><div className="spinner"></div>Loading match...</div>
  if (!match) return <div className="empty-state">Match not found</div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Match Details</h1>
        <p className="page-subtitle">Review potential match</p>
      </div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Status: <span className={`status-badge status-${match.status}`}>{match.status}</span></h3>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            {match.status === 'pending' && (<>
              <button className="btn-primary" onClick={()=>setStatus('confirmed')}>Confirm</button>
              <button className="btn-danger" onClick={()=>setStatus('rejected')}>Reject</button>
            </>)}
            {match.status === 'confirmed' && (
              <button className="btn-primary" onClick={()=>setStatus('resolved')}>Mark Resolved</button>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <MatchItem item={match.itemAId} />
          <MatchItem item={match.itemBId} />
        </div>
      </div>
    </div>
  )
}


// Admin Users Management
function AdminUsersPage() {
  const { isAdmin } = useAuth()
  const [users, setUsers] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [filters, setFilters] = React.useState({ search: '' })

  React.useEffect(() => {
    if (isAdmin) {
      loadUsers()
    }
  }, [isAdmin, filters])

  async function loadUsers() {
    setLoading(true)
    try {
      const data = await api.admin.getUsers(filters)
      setUsers(data.users || [])
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateUserRole(userId, role) {
    try {
      await api.admin.updateUserRole(userId, { role })
      loadUsers() // Reload users
    } catch (error) {
      console.error('Failed to update user role:', error)
      alert('Failed to update user role')
    }
  }

  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Manage Users</h1>
        <p className="page-subtitle">View and manage user accounts</p>
      </div>

      <div className="search-form">
        <div className="search-form-grid">
          <input 
            value={filters.search} 
            onChange={e => setFilters({...filters, search: e.target.value})} 
            placeholder="Search users..." 
          />
        </div>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          Loading users...
        </div>
      ) : (
        <div className="items-grid">
          {users.map(user => (
            <div key={user._id} className="item-card">
              <div className="item-content">
                <div className="item-header">
                  <h3 className="item-title">{user.name}</h3>
                  <span className={`item-type ${user.role === 'admin' ? 'found' : 'lost'}`}>
                    {user.role}
                  </span>
                </div>
                <div className="item-meta">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span>📧</span>
                    <span>{user.email}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span>📱</span>
                    <span>{user.mobileNumber || 'Not provided'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CalendarIcon />
                    <span>Joined: {new Date(user.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <select 
                    value={user.role} 
                    onChange={e => updateUserRole(user._id, e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="user">User</option>
                    <option value="business">Business</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button className="btn-secondary" onClick={()=> api.admin.suspendUser(user._id, { isSuspended: !user.isSuspended }).then(loadUsers)}>
                    {user.isSuspended ? 'Unsuspend' : 'Suspend'}
                  </button>
                  <button className="btn-danger" onClick={()=> { if (confirm('Delete user?')) api.admin.deleteUser(user._id).then(loadUsers) }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}



// Notifications page
function NotificationsPage() {
  const { isAuthed } = useAuth()
  const [notifications, setNotifications] = React.useState([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (isAuthed) {
      loadNotifications()
    }
  }, [isAuthed])

  async function loadNotifications() {
    setLoading(true)
    try {
      const data = await api.getNotifications()
      setNotifications(data.notifications || [])
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(notificationId) {
    try {
      await api.markNotificationRead(notificationId)
      setNotifications(prev => prev.map(n => 
        n._id === notificationId ? { ...n, read: true } : n
      ))
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  async function deleteNotification(notificationId) {
    if (!confirm('Are you sure you want to delete this notification?')) return
    
    try {
      await api.deleteNotification(notificationId)
      setNotifications(prev => prev.filter(n => n._id !== notificationId))
    } catch (error) {
      console.error('Failed to delete notification:', error)
      alert('Failed to delete notification')
    }
  }

  async function markAllAsRead() {
    try {
      await api.markAllNotificationsRead()
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (error) {
      console.error('Failed to mark all as read:', error)
      alert('Failed to mark all notifications as read')
    }
  }

  async function clearAllNotifications() {
    if (!confirm('Are you sure you want to delete ALL notifications? This cannot be undone.')) return
    
    try {
      await api.clearAllNotifications()
      setNotifications([])
    } catch (error) {
      console.error('Failed to clear notifications:', error)
      alert('Failed to clear notifications')
    }
  }

  if (!isAuthed) return <Navigate to="/login" replace />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Notifications</h1>
        <p className="page-subtitle">Your match notifications and updates</p>
        {notifications.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={markAllAsRead}>
              Mark All as Read
            </button>
            <button className="btn-danger" onClick={clearAllNotifications}>
              Clear All Notifications
            </button>
          </div>
        )}
      </div>
      
      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          Loading notifications...
        </div>
      ) : notifications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔔</div>
          <h3 className="empty-state-title">No notifications</h3>
          <p className="empty-state-description">
            You'll receive notifications when matches are found for your items.
          </p>
        </div>
      ) : (
        <div className="items-grid">
          {notifications.map(notification => (
            <div key={notification._id} className="item-card" style={{ 
              opacity: notification.read ? 0.7 : 1,
              borderLeft: notification.read ? 'none' : '4px solid var(--primary-color)'
            }}>
              <div className="item-content">
                <div className="item-header">
                  <h3 className="item-title" style={{ 
                    fontWeight: notification.read ? 'normal' : '600' 
                  }}>
                    {notification.message}
                  </h3>
                  {!notification.read && (
                    <span className="status-badge status-pending">New</span>
                  )}
                </div>
                
                <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {new Date(notification.createdAt).toLocaleString()}
                </div>

                {notification.meta?.matchId && (
                  <div style={{ marginBottom: '1rem' }}>
                    <Link 
                      to={`/matches`} 
                      className="btn-secondary"
                      style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
                    >
                      View Match
                    </Link>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {!notification.read && (
                    <button 
                      className="btn-primary" 
                      onClick={() => markAsRead(notification._id)}
                      style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
                    >
                      Mark as Read
                    </button>
                  )}
                  <button 
                    className="btn-danger" 
                    onClick={() => deleteNotification(notification._id)}
                    style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
                  >
                    Delete
                  </button>
                  <Link to="/matches" className="btn-outline" style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}>
                    View All Matches
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Profile page
function ProfilePage() {
  const { isAuthed, user, setUser } = useAuth()
  const [loading, setLoading] = React.useState(false)
  const [message, setMessage] = React.useState('')
  
  if (!isAuthed) return <Navigate to="/login" replace />
  
  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const form = new FormData(e.currentTarget)
      const name = form.get('name')
      const email = form.get('email')
      const mobileNumber = form.get('mobileNumber')
      
      // Basic mobile number validation
      const mobileRegex = /^[\+]?[1-9][\d]{0,15}$/;
      if (!mobileRegex.test(mobileNumber.replace(/[\s\-\(\)]/g, ''))) {
        setMessage('Invalid mobile number format')
        return
      }
      
      const response = await api.updateProfile({ name, email, mobileNumber })
      setUser(response.user)
      setMessage('Profile updated successfully!')
    } catch (error) {
      console.error('Profile update failed:', error)
      setMessage('Failed to update profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
        <p className="page-subtitle">Manage your contact information</p>
      </div>
      
      <div className="form-container">
        <form onSubmit={onSubmit}>
          <h2 className="form-title">Contact Information</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Your contact information is required for reporting lost and found items. 
            This helps others reach you when matches are found.
          </p>
          
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input 
              name="name" 
              defaultValue={user?.name || ''}
              placeholder="Enter your full name" 
              required 
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input 
                name="email" 
                type="email" 
                defaultValue={user?.email || ''}
                placeholder="Enter your email" 
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <input 
                name="mobileNumber" 
                type="tel" 
                defaultValue={user?.mobileNumber || ''}
                placeholder="Enter your mobile number (e.g., +1234567890)" 
                required 
              />
            </div>
          </div>
          <small style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem', display: 'block' }}>
            Contact information is required for reporting lost or found items
          </small>
          
          {message && (
            <div style={{ 
              padding: '0.75rem', 
              borderRadius: 'var(--radius-md)', 
              marginBottom: '1rem',
              backgroundColor: message.includes('successfully') ? 'var(--success-bg)' : 'var(--error-bg)',
              color: message.includes('successfully') ? 'var(--success-color)' : 'var(--error-color)',
              border: `1px solid ${message.includes('successfully') ? 'var(--success-border)' : 'var(--error-border)'}`
            }}>
              {message}
            </div>
          )}
          
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? (
              <>
                <div className="spinner"></div>
                Updating profile...
              </>
            ) : (
              'Update Profile'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}


export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<BrowsePage />} />
            <Route path="/recent" element={<RecentPostsPage />} />
            <Route path="/report" element={<SubmitItemPage title="Report Lost or Found Item" />} />
            <Route path="/submit/lost" element={<SubmitItemPage defaultType="lost" title="Submit Lost Property" />} />
            <Route path="/submit/found" element={<SubmitItemPage defaultType="found" title="Submit Found Property" />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/mine" element={<MinePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/items" element={<AdminItemsPage />} />
            <Route path="/admin/items/:id" element={<AdminItemDetailsPage />} />
            <Route path="/admin/matches" element={<AdminMatchesPage />} />
            <Route path="/admin/matches/:id" element={<AdminMatchDetailsPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  )
}
