export const boardStyles = {
  darkSquareStyle: { backgroundColor: "#b8966e" },
  lightSquareStyle: { backgroundColor: "#f0e8dc" },
}

export const notationStyles = {
  darkSquareNotationStyle: { color: "#f0e8dc" },
  lightSquareNotationStyle: { color: "#8a6d4f" },
  alphaNotationStyle: {
    fontSize: "9px",
    position: "absolute" as const,
    bottom: 1,
    right: 3,
    userSelect: "none" as const,
  },
  numericNotationStyle: {
    fontSize: "9px",
    position: "absolute" as const,
    top: 1,
    left: 2,
    userSelect: "none" as const,
  },
}

export const boardSize = "min(70vmin, 580px)"
