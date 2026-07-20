import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../src/client/components/primitives/empty-state.js';

const meta: Meta = {
  title: 'Primitives/EmptyState',
  component: 's-empty-state',
  argTypes: {
    icon: { control: 'text' },
    heading: { control: 'text' },
    description: { control: 'text' },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: (args) => html`
    <s-empty-state
      icon=${args.icon}
      heading=${args.heading}
      description=${args.description}
      size=${args.size}
    ></s-empty-state>
  `,
  args: { icon: '📭', heading: 'No Data', description: 'There is nothing to display', size: 'md' },
};

export const Large: Story = {
  render: () => html`
    <s-empty-state
      icon="🧠"
      heading="SeNARS Cognitive HUD"
      description="Send a message to start populating the knowledge graph"
      size="lg"
    >
      <s-button variant="primary" slot="action">Send a message</s-button>
    </s-empty-state>
  `,
};

export const Small: Story = {
  render: () => html`
    <s-empty-state
      icon="🔍"
      heading="No concepts"
      description="Send a message to populate the graph"
      size="sm"
    ></s-empty-state>
  `,
};

export const WithAction: Story = {
  render: () => html`
    <s-empty-state
      icon="⚠️"
      heading="Connection Lost"
      description="Attempting to reconnect..."
      size="md"
    >
      <s-button variant="ghost" slot="action">Retry Now</s-button>
    </s-empty-state>
  `,
};
