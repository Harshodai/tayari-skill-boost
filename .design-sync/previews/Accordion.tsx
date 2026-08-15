import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

export function JobRequirements() {
  return (
    <Accordion type="single" collapsible defaultValue="requirements" style={{ width: 440 }}>
      <AccordionItem value="requirements">
        <AccordionTrigger>Requirements</AccordionTrigger>
        <AccordionContent>
          5+ years with React and TypeScript, experience shipping design systems at scale.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="responsibilities">
        <AccordionTrigger>Responsibilities</AccordionTrigger>
        <AccordionContent>
          Own the component library, partner with design on tokens, mentor two engineers.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="benefits">
        <AccordionTrigger>Benefits</AccordionTrigger>
        <AccordionContent>
          Equity, full health coverage, $2,000 annual learning stipend, unlimited PTO.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function ApplicationFaq() {
  return (
    <Accordion type="multiple" defaultValue={['ats', 'timeline']} style={{ width: 440 }}>
      <AccordionItem value="ats">
        <AccordionTrigger>How is my ATS match score calculated?</AccordionTrigger>
        <AccordionContent>
          We compare your resume's skills and keywords against the job description using
          TF-IDF cosine similarity plus a heuristic scoring pass.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="timeline">
        <AccordionTrigger>When will Stripe respond?</AccordionTrigger>
        <AccordionContent>
          Most recruiters respond within 5–10 business days after your interview.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="withdraw">
        <AccordionTrigger>Can I withdraw an application?</AccordionTrigger>
        <AccordionContent>
          Yes — open the application detail page and choose "Withdraw application."
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
