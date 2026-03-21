import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
      <Link to="/" className="text-sm text-accent-orange hover:underline">
        Go home
      </Link>
    </div>
  )
}
