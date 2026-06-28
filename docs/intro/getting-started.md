# Getting Started with SeNARS: Your Journey into Neuro-Symbolic AI

This comprehensive guide provides a detailed walkthrough to get the SeNARS system up and running on your local machine,
from installation to advanced programmatic interaction. SeNARS represents a revolutionary neuro-symbolic cognitive
architecture that combines the precision of symbolic reasoning with the creativity of neural processing, offering
transformative potential for artificial intelligence applications.

## 1. Prerequisites: Setting the Foundation

Before beginning your journey with SeNARS, ensure your development environment meets the following requirements:

- **Node.js**: Version 18 or higher is recommended for optimal performance and compatibility. SeNARS leverages modern
  JavaScript features and async capabilities. You can download it from [nodejs.org](https://nodejs.org/).
- **npm**: Node.js's package manager, which is included with the Node.js installation. SeNARS utilizes a sophisticated
  dependency management system with multiple workspaces.
- **Git**: The version control system used to clone and manage the project repository. You can download it
  from [git-scm.com](https://git-scm.com/).
- **System Resources**: Adequate RAM (8GB+ recommended) and disk space for model downloads and processing. SeNARS'
  neural components require memory for embeddings and model operations.
- **Text Editor**: A code editor with JavaScript/TypeScript support (VS Code recommended) for optimal development
  experience.

## 2. Installation: Building Your Cognitive Environment

### Cloning the Repository

First, clone the SeNARS repository to your local machine. Open your terminal, navigate to the directory where you want
to store the project, and run the following command:

```bash
git clone https://github.com/automenta/senars8.git
```

### Navigating to the Project Directory

Navigate into the newly created project directory:

```bash
cd senars8
```

### Installing Dependencies

Install all the required dependencies for the entire project (including the `core`, `agent`, and `ui` workspaces) by
running `npm install` in the root directory:

```bash
npm install
```

This command will download and set up all the necessary packages defined in the `package.json` files. During
installation, you may see messages about downloading transformer models if you're using the default neural components.
This is normal and expected.

### Verification of Installation

After installation completes, verify that the setup was successful by running:

```bash
npm run build
```

This will compile the project and ensure all dependencies are correctly configured.

## 3. A Comprehensive Tour of the Project Structure

Understanding the architecture is crucial for effective development with SeNARS. The project is organized into several
key components:

### Core Architecture (`/core`)

The `/core` directory contains the fundamental cognitive architecture:

- **`/core/core`**: Core data structures including `Term`, `Task`, `TaskFactory`, and foundational utilities
- **`/core/memory`**: Sophisticated memory management system with short-term and long-term storage
- **`/core/reasoner`**: Comprehensive reasoning engine with inference rules, planners, and contradiction analyzers
- **`/core/lm`**: Neural language model integration with specialized services (HypothesisGenerator, PlanRepairer, etc.)
- **`/core/system`**: System orchestration including Cycle, System, Perception, and MetaCognition modules
- **`/core/parser`**: Narsese grammar parser for processing symbolic representations
- **`/core/config`**: Configuration management system for fine-tuning cognitive parameters

### Agent Layer (`/agent`)

The `/agent` directory implements the agent communication layer:

- **`Agent.js`**: The primary agent class that orchestrates the cognitive system
- **`server.js`**: WebSocket server implementation for real-time interaction with clients
- **`MCP.js`**: Message Control Protocol implementation for standardized communication

### Testing & Demos (`/tests`)

The `/tests` directory contains comprehensive testing infrastructure:

- **`/tests/demos`**: Extensive collection of demonstration scripts showcasing various system capabilities
- **`/tests/unit`**: Unit tests for individual components
- **`/tests/integration`**: Integration tests for system-level functionality

### Documentation (`/docs`)

The `/docs` directory contains comprehensive documentation:

- **`/docs/intro`**: Introduction, conceptual overview, and getting started guides
- **`/docs/tech`**: Technical specifications, API references, and deep-dive documentation
- **`/docs/biz`**: Business applications, market potential, and strategic use cases

## 4. Running the Full Application: Experiencing SeNARS in Action

The most intuitive way to experience SeNARS' capabilities is to run the complete application with both the agent server
and the web UI.

### Starting the Development Environment

From the project's root directory, run:

```bash
npm run dev
```

This command uses `concurrently` to start multiple processes:

1. The agent's WebSocket server, typically listening on port 8080
2. The UI's development server, which will typically open in your web browser automatically

### Interacting with the System

Once the application is running, you can:

- Access the web interface to send tasks and observe the reasoning process
- Monitor real-time cognitive cycles and task processing
- Observe the integration between symbolic reasoning and neural processing
- Experiment with different types of inputs (beliefs, goals, questions)

## 5. Running Standalone Demos: Understanding Core Capabilities

The demos in the `/tests/demos` directory provide excellent examples of specific SeNARS capabilities. They are
implemented as tests and can be run using `jest` or Node.js directly.

### Running Specific Demos

To run a specific demo using npm test:

```bash
npm test tests/demos/basic-demo.js
```

To run a demo directly with Node.js:

```bash
node tests/demos/basic-demo.js
```

### Key Demo Examples

- **`basic-demo.js`**: Demonstrates fundamental reasoning with simple inheritance rules
- **`temporal-demo.js`**: Shows temporal reasoning capabilities and sequence analysis
- **`planning-demo.js`**: Illustrates the planning system and goal achievement
- **`contradiction-demo.js`**: Shows contradiction detection and resolution
- **`neuro-symbolic-demo.js`**: Demonstrates the integration between symbolic and neural components

Each demo will output detailed information about the system's reasoning process to your console, showing how it derives
new knowledge from initial beliefs and how the cognitive cycle operates.

## 6. Configuration & Customization: Tailoring Cognitive Behavior

SeNARS offers extensive configuration options to customize cognitive behavior:

- **Memory Management**: Configure forgetting strategies, consolidation thresholds, and storage policies
- **Reasoning Parameters**: Adjust inference rules, temporal reasoning settings, and strategy selection
- **Neural Components**: Configure model selection, embedding strategies, and processing parameters
- **Cognitive Control**: Adjust attention mechanisms, priority calculations, and resource allocation

Configuration can be set via the config system or through the factory creation method.

## 7. Advanced Development: Extending SeNARS Capabilities

SeNARS is designed for extensibility:

- **Custom Inference Rules**: Add new reasoning capabilities by creating custom rules
- **Extended Task Types**: Implement new punctuation types or cognitive operations
- **Specialized Services**: Create additional neural services that integrate with the cognitive cycle
- **Alternative Planning Strategies**: Implement new planning algorithms for specific use cases
- **Memory Enhancements**: Add new memory management strategies or storage backends

## 9. What's Next? Exploring the Cognitive Frontier

- **Deep Exploration**: Run all demo files in `/tests/demos` to understand advanced features like temporal reasoning,
  planning, contradiction handling, and neuro-symbolic integration
- **API Mastery**: Dive into the `api-reference.md` document to understand all available methods and capabilities
- **Architecture Deep Dive**: Read `deep-dive.md` to understand the internal mechanisms and advanced features
- **Contribution**: Explore contributing to the project by adding new features, improving documentation, or expanding
  test coverage
- **Experimentation**: Modify and extend the system to explore new cognitive architectures and capabilities
- **Real-World Applications**: Consider how SeNARS' capabilities could be applied to solve complex problems in your
  domain

The SeNARS architecture represents a significant advancement in AI systems, providing a foundation for truly
intelligent, explainable, and adaptive artificial intelligence. Your journey with this revolutionary cognitive
architecture is just beginning.