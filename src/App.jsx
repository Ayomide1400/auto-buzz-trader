import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import StockDetail from './pages/StockDetail'
import Watchlist from './pages/Watchlist'
import History from './pages/History'
import Settings from './pages/Settings'
import './App.css'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="stock/:symbol" element={<StockDetail />} />
        <Route path="watchlist" element={<Watchlist />} />
        <Route path="history" element={<History />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
