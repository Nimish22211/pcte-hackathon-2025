import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "../ui/button"
import { useAuth } from "../../context/AuthContext"
import NotificationCenter from "../Common/NotificationCenter"
import { User, LogOut } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'


export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "max-w-5xl mx-auto mt-4 rounded-full border border-border bg-card/80 backdrop-blur-lg"
          : "w-full bg-card/50 backdrop-blur-lg border-b border-border"
      }`}
    >
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">
              <Link to="/">UP</Link>
            </span>
          </div>
          <span className="text-xl font-bold text-foreground">
           <Link to="/">
            Urban Pulse
           </Link>
            </span>
        </div>

        <nav className="hidden md:flex items-center space-x-8">
          <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
            How It Works
          </a>
          <a href="#transparency" className="text-muted-foreground hover:text-foreground transition-colors">
            Transparency
          </a>
          <a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">
            FAQ
          </a>
        </nav>

        <div className="flex items-center space-x-4">
          {user ? (
            <>
              <NotificationCenter />
              <Button asChild variant="outline">
                <Link to="/map">Map</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/report">Report</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span>{user.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {user.role === "citizen" &&
                  <DropdownMenuItem asChild> 
                    <Link to="/dashboard">Dashboard</Link>
                  </DropdownMenuItem>
                  }
                  {user.role === 'admin' && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin/dashboard">Admin Panel</Link>
                    </DropdownMenuItem>
                  )}
                  {user.role === 'official' && (
                    <DropdownMenuItem asChild>
                      <Link to="/official/dashboard">Official Panel</Link>
                    </DropdownMenuItem>
                  )}
                  {user.role === 'serviceman' && (
                    <DropdownMenuItem asChild>
                      <Link to="/serviceman/dashboard">Service Man Panel</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" className="text-muted-foreground hover:text-foreground">
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link to="/register">Register</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/report">Report</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}