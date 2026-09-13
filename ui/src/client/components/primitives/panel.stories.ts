import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './panel.ts';

const meta: Meta = {
  title: 'Primitives/Panel',
  component: 's-panel',
  argTypes: {
    heading: { control: 'text' },
    docked: {
      control: 'select',
      options: ['left', 'right', 'top', 'bottom'],
    },
    closable: { control: 'boolean' },
    noPad: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: (args) => html`
    <s-panel heading=${args.heading} docked=${args.docked} ?closable=${args.closable} ?noPad=${args.noPad}>
      <div style="padding: 16px;">Panel content goes here</div>
    </s-panel>
  `,
  args: { heading: 'Panel', docked: 'right', closable: true, noPad: false },
};

export const NoPadding: Story = {
  render: () => html`
    <s-panel heading="No Padding" docked="right" noPad>
      <div style="background: var(--colors-semantic-bg-elevated); padding: 16px;">
        Content with no panel padding
      </div>
    </s-panel>
  `,
};

export const NotClosable: Story = {
  render: () => html`
    <s-panel heading="Not Closable" docked="left" ?closable=${false}>
      <div style="padding: 16px;">This panel cannot be closed</div>
    </s-panel>
  `,
};
