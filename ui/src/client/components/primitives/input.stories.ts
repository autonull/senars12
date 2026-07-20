import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../src/client/components/primitives/input.js';

const meta: Meta = {
  title: 'Primitives/Input',
  component: 's-input',
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'search', 'password', 'email', 'number'],
    },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    value: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: (args) =>
    html`<s-input type=${args.type} placeholder=${args.placeholder} ?disabled=${args.disabled} value=${args.value}></s-input>`,
  args: { type: 'text', placeholder: 'Enter text...', disabled: false, value: '' },
};

export const Search: Story = {
  render: () => html`<s-input type="search" placeholder="Search concepts..."></s-input>`,
};

export const Disabled: Story = {
  render: () => html`<s-input disabled value="Cannot edit"></s-input>`,
};

export const WithValue: Story = {
  render: () => html`<s-input value="Pre-filled value"></s-input>`,
};
