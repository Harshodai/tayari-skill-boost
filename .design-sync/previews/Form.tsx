import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const jobSchema = z.object({
  title: z.string().min(2, 'Job title is required'),
  company: z.string().min(1, 'Company is required'),
});

type JobFormValues = z.infer<typeof jobSchema>;

export function AddJobApplication() {
  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: { title: 'Senior Frontend Engineer', company: 'Stripe' },
    mode: 'onChange',
  });

  return (
    <Form {...form}>
      <form style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 340 }} onSubmit={form.handleSubmit(() => {})}>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Job title</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Staff Product Designer" {...field} />
              </FormControl>
              <FormDescription>Exactly as listed on the job posting.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="company"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Anthropic" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Add to tracker</Button>
      </form>
    </Form>
  );
}

export function WithValidationErrors() {
  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: { title: '', company: '' },
    mode: 'onChange',
  });

  React.useEffect(() => {
    form.trigger();
  }, [form]);

  return (
    <Form {...form}>
      <form style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 340 }} onSubmit={form.handleSubmit(() => {})}>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Job title</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Staff Product Designer" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="company"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Anthropic" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" variant="outline">
          Add to tracker
        </Button>
      </form>
    </Form>
  );
}
