# SeNARS API Reference: Comprehensive Technical Interface Guide

This document provides a complete reference for the SeNARS public API, detailing all interfaces, methods, and
configuration options. SeNARS' sophisticated neuro-symbolic architecture is exposed through a comprehensive API that
enables both high-level interaction and fine-grained control over the cognitive processes.

## System Creation & Initialization

The primary way to create a SeNARS system is by using the `createSystem` function, which provides extensive
configuration and customization capabilities.

### `createSystem(userConfig, components)`

* **Description:** Creates and initializes a new SeNARS system with comprehensive configuration options and component
  customization capabilities.
* **Arguments:**
    * `userConfig` (Object, optional): A configuration object to override the default system settings. Comprehensive
      options include:
        * `FOCUS_SET_SIZE`: Number of tasks selected for reasoning in each cognitive cycle (default: 20)
        * `ACTIONABLE_GOAL_PRIORITY_THRESHOLD`: Minimum priority for goals to be executed (default: 0.1)
        * `cycle.TICK_DELAY_MS`: Delay between cognitive cycles in milliseconds (default: 50)
        * `reasoner.strategy`: Inference strategy (default: 'BagSamplingStrategy')
        * `LM` configurations: Model selection, provider settings, embedding parameters
        * `memory` configurations: Forgetting strategies, storage policies, consolidation thresholds
    * `components` (Object, optional): An object containing custom components to override default implementations (e.g.,
      custom reasoner, memory system, planner). This enables extensive system customization for specialized
      applications.
* **Returns:** A fully configured `System` instance with all cognitive components properly integrated.

---

## System API: Core Cognitive Interface

The `System` class serves as the main interface for interacting with the SeNARS cognitive architecture. It orchestrates
all cognitive processes and provides access to the complete cognitive functionality.

### Core System Methods

* **`initialize(constitutionTasks)`**
    * **Description:** Initializes the system with a comprehensive set of core tasks, beliefs, or goals that form the "
      constitution" - the foundational knowledge and objectives that guide cognitive behavior.
    * **Arguments:**
        * `constitutionTasks` (Array): An array of task objects representing initial beliefs, goals, and questions that
          establish the system's foundational knowledge and objectives.
    * **Realizable Potential:** Enables the creation of specialized cognitive agents with domain-specific foundational
      knowledge and objectives.

* **`runCycle()`**
    * **Description:** Executes a single complete cognitive cycle, encompassing perception, attention management,
      reasoning, meta-cognition, neural enrichment, and action planning. This represents one complete iteration of the
      system's thought process.
    * **Returns:** Promise resolving with detailed information about the cycle execution, including derived tasks,
      processed tasks, and performance metrics.

* **`start(maxCycles)`**
    * **Description:** Starts the continuous operation of the system, executing cognitive cycles in a continuous loop.
      This enables the system to operate autonomously over extended periods.
    * **Arguments:**
        * `maxCycles` (Number, optional): The maximum number of cycles to execute. If not provided, the system will run
          indefinitely until explicitly stopped.
    * **Realizable Potential:** Supports long-term autonomous operation for applications requiring continuous cognitive
      processing.

* **`stop()`**
    * **Description:** Stops the system's execution loop gracefully, ensuring all pending operations complete before
      halting. This includes stopping neural processing and cleaning up resources.
    * **Realizable Potential:** Enables controlled operation with precise start/stop capabilities for integration with
      other systems.

* **`addTasks(tasks)`**
    * **Description:** Adds one or more new tasks to the system's memory for cognitive processing. Tasks can be beliefs,
      goals, or questions that become part of the system's knowledge base.
    * **Arguments:**
        * `tasks` (Array|Object): A single task object or an array of task objects to be integrated into the cognitive
          cycle.
    * **Realizable Potential:** Enables dynamic interaction with the system, supporting real-time input of new
      information, goals, or queries.

* **`reset()`**
    * **Description:** Completely resets the system's state, clearing all memory contents (both short-term and
      long-term), resetting cycle counts, and restoring initial configuration. This provides a clean slate for new
      cognitive sessions.
    * **Realizable Potential:** Supports session-based operation and clean state management for multiple independent
      cognitive operations.

### Advanced System Control Methods

* **`getMemory()`**
    * **Description:** Returns direct access to the memory component for advanced memory management operations.
    * **Returns:** The memory instance with full access to memory operations.

* **`getReasoner()`**
    * **Description:** Provides direct access to the reasoning component for advanced reasoning operations and rule
      management.
    * **Returns:** The reasoner instance with access to inference rules and reasoning strategies.

* **`getLM()`**
    * **Description:** Provides direct access to the language model component for neural processing operations.
    * **Returns:** The LM instance with access to neural services and embeddings.

---

## Introspection API: Cognitive Transparency

The sophisticated `Introspection` API provides comprehensive visibility into the internal cognitive processes of the
SeNARS system. This enables complete transparency and detailed analysis of the system's reasoning, making it ideal for
applications requiring explainable AI.

### System Status Methods

* **`getStatus()`**
    * **Description:** Returns a comprehensive object containing the current status of the system, including operational
      state, performance metrics, cognitive load, and resource utilization.
    * **Returns:** Object containing:
        * `isRunning`: Boolean indicating if the system is currently processing cycles
        * `cycleCount`: Total number of cognitive cycles executed
        * `currentFocusSetSize`: Number of tasks currently in focus
        * `memoryStatistics`: Comprehensive memory usage statistics
        * `performanceMetrics`: Cycle execution time, reasoning efficiency, etc.

* **`getConfig()`**
    * **Description:** Returns the complete runtime configuration object of the system, including all cognitive
      parameters and settings.
    * **Returns:** Complete configuration object with all system parameters.

### Knowledge Base Query Methods

* **`getTask(id)`**
    * **Description:** Retrieves a specific task from memory by its unique identifier, providing complete task
      information including truth values, priority, and temporal information.
    * **Arguments:**
        * `id` (String|Number): The unique identifier of the task to retrieve.
    * **Returns:** The requested task object with complete state information.

* **`getTerm(key)`**
    * **Description:** Retrieves a specific term from memory by its unique key, providing complete term structure and
      embedding information.
    * **Arguments:**
        * `key` (String): The unique key of the term to retrieve.
    * **Returns:** The requested term object with complete structure information.

* **`queryTasks(filters)`**
    * **Description:** Returns an array of tasks that match the provided comprehensive filter criteria, supporting
      complex queries based on truth values, priority ranges, temporal properties, and semantic similarity.
    * **Arguments:**
        * `filters` (Object): Filter object supporting:
            * `punctuation`: Filter by task type (., !, ?)
            * `priorityRange`: Filter by priority range
            * `truthValueRange`: Filter by truth value criteria
            * `timeRange`: Filter by temporal properties
            * `semanticSimilarity`: Filter by similarity to a concept
    * **Returns:** Array of matching task objects.

* **`getAllTerms()`**
    * **Description:** Returns an array of all terms currently in the system's memory, providing complete access to the
      system's conceptual vocabulary.
    * **Returns:** Array of all term objects.

* **`getAllTasks()`**
    * **Description:** Returns all tasks in memory with filtering options, providing complete visibility into the
      system's active knowledge.
    * **Arguments:**
        * `filterOptions` (Object, optional): Options to filter tasks by various criteria.
    * **Returns:** Array of all task objects.

### Reasoning & Planning Information Methods

* **`getAvailableRules()`**
    * **Description:** Returns an array of the names of all available inference rules, providing insight into the
      system's reasoning capabilities.
    * **Returns:** Array of rule names with detailed information about each rule.

* **`getRuleInfo(ruleName)`**
    * **Description:** Returns comprehensive information about a specific inference rule, including its implementation,
      applicability, and usage statistics.
    * **Arguments:**
        * `ruleName` (String): The name of the rule to retrieve information for.
    * **Returns:** Detailed rule information including condition, action, and metadata.

* **`getActivePlans()`**
    * **Description:** Returns information about all currently active plans being executed or developed by the system.
    * **Returns:** Array of plan objects with status, steps, and execution information.

* **`getContradictions()`**
    * **Description:** Returns a comprehensive array of all contradictions the system has detected, including conflict
      details and resolution status.
    * **Returns:** Array of contradiction objects with detailed conflict analysis.

### Performance & Analysis Methods

* **`getReasoningTrace(taskId)`**
    * **Description:** Returns the complete reasoning trace showing how a specific task was derived, including all
      intermediate steps and inference rules used.
    * **Arguments:**
        * `taskId` (String|Number): The ID of the task to trace.
    * **Returns:** Array of reasoning steps showing the complete derivation path.

* **`getMemoryStatistics()`**
    * **Description:** Returns detailed statistics about the system's memory usage, organization, and performance.
    * **Returns:** Object containing detailed information about:
        * Short-term memory: Task counts, access patterns, priority distributions
        * Long-term memory: Consolidation statistics, forgetting patterns, retention rates
        * Indexing performance: Query efficiency, search times, index utilization

* **`getProcessingMetrics()`**
    * **Description:** Returns comprehensive metrics about cognitive processing performance including reasoning
      efficiency, neural processing times, and resource utilization.
    * **Returns:** Object containing detailed performance metrics for all cognitive components.

### Event Management Methods

* **`on(eventName, callback)`**
    * **Description:** Registers a callback function to be executed when a specific cognitive event occurs, enabling
      real-time monitoring of system operations.
    * **Arguments:**
        * `eventName` (String): The name of the cognitive event to listen for (e.g., 'SystemCycleStarted', '
          TaskDerived', 'ContradictionDetected', 'PlanExecuted').
        * `callback` (Function): The function to execute when the event is triggered, receiving detailed event
          information.
    * **Realizable Potential:** Enables integration with external monitoring systems and real-time response to cognitive
      events.

* **`off(eventName, callback)`**
    * **Description:** Removes a previously registered event listener, providing precise control over event handling.
    * **Arguments:**
        * `eventName` (String): The name of the event.
        * `callback` (Function): The callback function to remove.

* **`getAvailableEvents()`**
    * **Description:** Returns a list of all available event types that can be monitored through the event system.
    * **Returns:** Array of available event names with descriptions.

---

## Advanced Configuration API

### Cognitive Strategy Configuration

* **`configureReasoningStrategy(strategyName, options)`**
    * **Description:** Dynamically configures the reasoning strategy with specific options, enabling adaptation to
      different problem types during operation.
    * **Arguments:**
        * `strategyName` (String): Name of the reasoning strategy to configure
        * `options` (Object): Configuration options for the strategy

* **`configureMemoryPolicy(policyName, parameters)`**
    * **Description:** Configures memory management policies including forgetting strategies, consolidation thresholds,
      and storage policies.
    * **Arguments:**
        * `policyName` (String): Name of the memory policy to configure
        * `parameters` (Object): Parameters for the policy

### Neural Component Configuration

* **`configureLMProvider(providerName, settings)`**
    * **Description:** Configures the neural language model provider with specific settings and parameters.
    * **Arguments:**
        * `providerName` (String): Name of the LM provider (e.g., 'xenova', 'ollama')
        * `settings` (Object): Provider-specific configuration settings

* **`getLMCapabilities()`**
    * **Description:** Returns information about the capabilities and current status of the neural language model
      component.
    * **Returns:** Object describing LM capabilities, loaded models, and resource usage.

This comprehensive API provides complete access to all SeNARS capabilities, enabling sophisticated applications that
leverage the full power of neuro-symbolic cognitive processing while maintaining complete transparency and control over
the cognitive processes.
