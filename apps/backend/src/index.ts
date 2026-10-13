import 'dotenv/config'
import { app } from './app.js'

const PORT = process.env.PORT || 5000

const server = app.listen(PORT, () => {
  console.log(`[Velora Backend] Server running on http://localhost:${PORT}`)
  console.log(`[Velora Backend] Health check available at http://localhost:${PORT}/api/health`)
})

export default server
