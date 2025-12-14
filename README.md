# React Pac-Man

A modern, responsive recreation of the classic Pac-Man arcade game built with React, TypeScript, and Tailwind CSS.

![Pac-Man Game Screenshot](https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop)

## 🎮 Features

*   **Classic Gameplay**: Navigate the maze, eat dots, avoid ghosts, and use power pellets to turn the tables.
*   **Multiple Levels**: Progress through 4 unique maze layouts with increasing speed and difficulty.
*   **Map Editor**: Create and save your own custom mazes to play and share.
*   **Game Modes**:
    *   **Classic**: Standard 3-lives gameplay.
    *   **Time Attack**: Score as many points as possible in 2 minutes.
*   **Mobile Friendly**: Fully responsive design with on-screen touch controls for mobile devices.
*   **Audio**: Synthesized sound effects and background ambience using the Web Audio API.
*   **High Scores**: Local storage persistence for high scores and custom maps.

## 🕹️ Controls

| Action | Keyboard | Touch / Mouse |
| :--- | :--- | :--- |
| **Move** | Arrow Keys | On-screen D-Pad |
| **Pause** | `P` or `Esc` | Pause Button |
| **Mute** | - | Speaker Button |

## 🛠️ Tech Stack

*   **React 18**: UI and State Management.
*   **TypeScript**: Type safety and game logic interfaces.
*   **Tailwind CSS**: styling and responsive design.
*   **Web Audio API**: Real-time sound synthesis.
*   **LocalStorage**: Data persistence.

## 🚀 Getting Started

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/react-pacman.git
    cd react-pacman
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Run the development server**
    ```bash
    npm start
    ```

4.  **Build for production**
    ```bash
    npm run build
    ```

## 🎨 Map Editor Guide

1.  Select **Map Editor** from the main menu.
2.  Select a tool from the bottom palette (Wall, Dot, Power Pellet, Spawn Points, Eraser).
3.  Click/Tap on the grid to paint.
4.  **Requirements**: You must place at least one **Pac-Man Spawn** (Yellow) and one **Ghost Spawn** (Red).
5.  Enter a name and click **Save**.
6.  Go back to the Main Menu -> **Custom Maps** to play your creation!

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
