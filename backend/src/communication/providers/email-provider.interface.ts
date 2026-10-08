export interface EmailProvider {
  sendEmail(
    to: string,
    subject: string,
    html: string,
    from?: string,
  ): Promise<void>;
}
