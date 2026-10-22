import { createBrowserRouter } from 'react-router'
import { HomeScreen } from '@/screens/home/HomeScreen'

export const router = createBrowserRouter([{ path: '/', element: <HomeScreen /> }])
