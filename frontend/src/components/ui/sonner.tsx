import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        style: {
          background: "var(--popover)",
          color: "var(--popover-foreground)",
          border: "1px solid var(--border)",
          borderRadius: "0.7rem",
          fontFamily: "var(--font-sans)",
          boxShadow: "0 24px 60px -30px #000",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
