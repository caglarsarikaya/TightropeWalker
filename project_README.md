# Tightrope Walker Game

A browser-based 3D game implemented using JavaScript and Three.js where the player must balance a character traversing a tightrope stretched between two mountains.

## Features

- Engaging physics-based gameplay with balance mechanics
- 3D environment with mountains, rope, and clouds
- Interactive UI with start, gameplay, and end screens
- Keyboard controls for movement and balance
- Wind effects that affect balance
- Modular architecture following SOLID principles

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- A modern web browser with WebGL support

### Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/tightrope-walker-game.git
   cd tightrope-walker-game
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Start the development server
   ```
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

## Game Controls

- **Up Arrow** or **W**: Move forward
- **Left Arrow** or **A**: Lean left
- **Right Arrow** or **D**: Lean right
- Releasing movement keys will slow down the character
- Releasing balance keys will allow the character to naturally rebalance

## Game Mechanics

- The character must traverse the tightrope from one mountain to another
- Balance is represented by a meter at the bottom of the screen
- Wind effects will randomly push the character left or right
- If the character's balance exceeds a certain threshold, they will fall
- Successfully reaching the other mountain is a win

## Development

### Project Structure

```
/tightrope-walker-game/
│── /src/
│   │── /models/        # Game logic (physics, character, environment)
│   │── /viewmodels/    # State management (game state, event handling)
│   │── /views/         # UI components (Three.js rendering, DOM elements)
│   │── Game.js         # Main entry point, initializes components
│── /assets/            # Game assets (will be used for models, textures, sounds)
│── /config/            # Configuration files
│── index.html          # Entry point for the browser
│── package.json        # Dependencies and scripts
│── vite.config.js      # Build configuration
```

### Building for Production

```
npm run build
```

This will create a `dist` directory with the built application.

## Future Enhancements

- Additional levels with increasing difficulty
- Character model with animations
- Mobile touch controls
- Sound effects and background music
- Power-ups and special abilities
- Multiplayer support

## License

This project is licensed under the MIT License - see the LICENSE file for details. 