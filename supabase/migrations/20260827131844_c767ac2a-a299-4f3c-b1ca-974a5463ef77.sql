
CREATE POLICY "payment_docs_read_staff" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-documents' AND public.is_staff(auth.uid()));
CREATE POLICY "payment_docs_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'payment-documents' AND public.has_role(auth.uid(),'admin'));
