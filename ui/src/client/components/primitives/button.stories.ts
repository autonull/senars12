import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../src/client/components/primitives/button.js';

const meta: Meta = {
  title: 'Primitives/Button',
  component: 's-button',
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj;

export const Primary: Story = {
  render: (args) => html`<s-button variant="primary" ?disabled=${args.disabled} ?loading=${args.loading}>Primary</s-button>`,
  args: { disabled: false, loading: false },
};

export const Secondary: Story = {
  render: () => html`<s-button variant="secondary">Secondary</s-button>`,
};

export const Ghost: Story = {
  render: () => html`<s-button variant="ghost">Ghost</s-button>`,
};

export const Danger: Story = {
  render: () => html`<s-button variant="danger">Danger</s-button>`,
};

export const Small: Story = {
  render: () => html`<s-button size="sm">Small</s-button>`,
};

export const Large: Story = {
  render: () => html`<s-button size="lg">Large</s-button>`,
};

export const Disabled: Story = {
  render: () => html`<s-button disabled>Disabled</s-button>`,
};

export const Loading: Story = {
  render: () => html`<s-button loading>Loading...</s-button>`,
};

export const AllVariants: Story = {
  render: () => html`
    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
      <s-button variant="primary">Primary</s-button>
      <s-button variant="secondary">Secondary</s-button>
      <s-button variant="ghost">Ghost</s-button>
      <s-button variant="danger">Danger</s-button>
    </div>
  `,
};

export const AllSizes: Story = {
  render: () => html`
    <div style="display: flex; gap: 12px; align-items: center;">
      <s-button size="sm">Small</s-button>
      <s-button size="md">Medium</s-button>
      <s-button size="lg">Large</s-button>
    </div>
  `,
};