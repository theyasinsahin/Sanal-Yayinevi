import "./Logo.css";

// variant="light": bordo bant gibi koyu zeminler için beyaz logo
function Logo({ variant = "default", className = "" }) {
  return (
    <img
      src={variant === "light" ? "/images/betik_beyaz.svg" : "/images/betik.svg"}
      alt="Betik logosu"
      className={`logo${className ? ` ${className}` : ""}`}
      width={40}
      height={40}
    />
  );
}

export default Logo;
