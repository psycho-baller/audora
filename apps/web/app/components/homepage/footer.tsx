import { Link } from "react-router";

export default function FooterSection() {
  return (
    <footer className="py-16 md:py-32 border-t">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center mb-8">
          <Link to="/" aria-label="go home" className="mx-auto block size-fit">
            <h3 className="text-2xl font-bold">Audora</h3>
          </Link>
          <p className="text-muted-foreground text-sm mt-2">
            Transform how you connect. Because human connection is the strongest force in the world.
          </p>
        </div>

        <div className="my-8 flex flex-wrap justify-center gap-6 text-sm">
          <Link
            to="https://x.com/rami__maalouf"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X/Twitter"
            className="text-muted-foreground hover:text-primary block"
          >
            <svg
              className="size-6"
              xmlns="http://www.w3.org/2000/svg"
              width="1em"
              height="1em"
              viewBox="0 0 24 24"
            >
              <path
                fill="currentColor"
                d="M10.488 14.651L15.25 21h7l-7.858-10.478L20.93 3h-2.65l-5.117 5.886L8.75 3h-7l7.51 10.015L2.32 21h2.65zM16.25 19L5.75 5h2l10.5 14z"
              ></path>
            </svg>
          </Link>
        </div>

        <div className="flex flex-wrap justify-center gap-6 text-sm mb-8">
          <Link to="#features" className="text-muted-foreground hover:text-primary">
            Features
          </Link>
          <Link to="#how-it-works" className="text-muted-foreground hover:text-primary">
            How It Works
          </Link>
          <Link to="#technologies" className="text-muted-foreground hover:text-primary">
            Technologies
          </Link>
          <Link to="/dashboard" className="text-muted-foreground hover:text-primary">
            Dashboard
          </Link>
        </div>

        <span className="text-muted-foreground block text-center text-sm">
          © {new Date().getFullYear()} Audora. All rights reserved. Built with ❤️ for deeper connections.
        </span>
      </div>
    </footer>
  );
}
