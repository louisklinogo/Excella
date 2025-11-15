import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  pixelBasedPreset,
  Row,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';
import { MessageCircleIcon, MessagesSquare } from 'lucide-react';
import type * as React from 'react';

interface AssistantUIWelcomeEmailProps {
  userName?: string;
  steps: {
    id: number;
    Description: React.ReactNode;
  }[];
  resources: {
    title: string;
    description: string;
    href: string;
    icon: string;
  }[];
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : '';

export const AssistantUIWelcomeEmail = ({
  userName,
  steps,
  resources,
}: AssistantUIWelcomeEmailProps) => {
  return (
    <Html>
      <Head />
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              colors: {
                brand: '#0ea5e9',
                brandDark: '#0284c7',
                offwhite: '#fafbfc',
                muted: '#64748b',
              },
              spacing: {
                0: '0px',
                20: '20px',
                30: '30px',
                45: '45px',
              },
            },
          },
        }}
      >
        <Preview>Welcome to assistant-ui - Build AI chat experiences in React</Preview>
        <Body className="bg-offwhite font-sans text-base">
          <Container className="mx-auto">
            <Text className="text-center text-2xl font-semibold text-gray-900 mb-2 flex items-center justify-center gap-2">
              <MessagesSquare className="size-5" />
              assistant-ui
            </Text>
            <Text className="text-center text-muted text-sm font-medium mb-30">
            UX of ChatGPT in your own app
            </Text>
          </Container>
          
          <Container className="bg-white rounded-lg shadow-sm p-45 mx-auto max-w-[600px]">
            <Heading className="my-0 text-center text-lg leading-8">
              assistant-ui is the TypeScript/React library for AI Chat.<br />
              {/* <span className="text-base font-normal text-muted">
                Built on shadcn/ui and Tailwind.
              </span> */}
            </Heading>

            <Section >
              <Row>
                {/* <Text className="text-base text-gray-700">
                  Hey {userName || 'there'} 👋
                </Text> */}
                <Text className="text-base text-gray-700">
                  Thanks for choosing <strong>assistant-ui</strong>. You're now equipped with the most flexible React framework for building production-ready AI chat interfaces.
                </Text>

                <Text className="text-base text-gray-700 mt-20">
                  Here's how to get started:
                </Text>
              </Row>
            </Section>

            <ul className="mt-20">{steps?.map(({ Description }) => Description)}</ul>

            <Section className="text-center mt-30">
              <Button 
                href="https://assistant-ui.com/docs/getting-started"
                className="rounded-lg bg-brand px-6 py-3 text-white font-medium inline-block"
              >
                Get Started →
              </Button>
            </Section>

           
          </Container>

          <Container className="mt-20 max-w-[600px]">
            <Section>
              <Row>
                <Column className="text-center">
                  <Link href="https://twitter.com/assistant_ui" className="text-muted text-sm mx-2">
                    Twitter
                  </Link>
                  <Link href="https://github.com/assistant-ui" className="text-muted text-sm mx-2">
                    GitHub
                  </Link>
                  <Link href="https://discord.gg/assistant-ui" className="text-muted text-sm mx-2">
                    Discord
                  </Link>
                </Column>
              </Row>
            </Section>
            <Text className="text-center text-muted text-sm mt-20">
              Made with ❤️ by the assistant-ui team
            </Text>
            <Text className="text-center text-muted text-xs mt-2 mb-45">
              © 2025 assistant-ui. All rights reserved.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

AssistantUIWelcomeEmail.PreviewProps = {
  userName: 'Sarah',
  steps: [
    {
      id: 1,
      Description: (
        <li className="mb-20 text-gray-700" key={1}>
          <strong>Install assistant-ui.</strong> Get started in seconds with{' '}
          <Link href="https://assistant-ui.com/docs/getting-started" className="text-brand">
            npm install assistant-ui
          </Link>{' '}
          and create your first chat interface.
        </li>
      ),
    },
    {
      id: 2,
      Description: (
        <li className="mb-20 text-gray-700" key={2}>
          <strong>Explore our components.</strong> From simple chat bubbles to complex tool UIs,{' '}
          <Link href="https://assistant-ui.com/docs/components" className="text-brand">
            browse our component library
          </Link>{' '}
          and see live examples.
        </li>
      ),
    },
    {
      id: 3,
      Description: (
        <li className="mb-20 text-gray-700" key={3}>
          <strong>Connect your LLM.</strong> Works seamlessly with OpenAI, Anthropic, or any LLM provider.{' '}
          <Link href="https://assistant-ui.com/docs/providers" className="text-brand">
            See integration guides
          </Link>.
        </li>
      ),
    },
    {
      id: 4,
      Description: (
        <li className="mb-20 text-gray-700" key={4}>
          <strong>Deploy your first assistant.</strong> Ship to production with built-in streaming, tool calling, and more.{' '}
          <Link href="https://assistant-ui.com/docs/deployment" className="text-brand">
            Read deployment guide
          </Link>.
        </li>
      ),
    },
  ],
  resources: [
    {
      title: 'Documentation',
      description: 'Complete guides and API reference',
      href: 'https://assistant-ui.com/docs',
      icon: '📖',
    },
    {
      title: 'Interactive Examples',
      description: 'Live demos with source code',
      href: 'https://assistant-ui.com/examples',
      icon: '🎨',
    },
    {
      title: 'GitHub Repository',
      description: 'Star us and contribute',
      href: 'https://github.com/assistant-ui/assistant-ui',
      icon: '💙',
    },
    {
      title: 'Join our Discord',
      description: 'Get help from the community',
      href: 'https://discord.gg/assistant-ui',
      icon: '💬',
    },
  ],
} satisfies AssistantUIWelcomeEmailProps;

export default AssistantUIWelcomeEmail;