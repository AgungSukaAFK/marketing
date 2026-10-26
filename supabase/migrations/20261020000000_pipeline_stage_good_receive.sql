-- Stage pipeline terakhir: 'Handover' → 'Good Receive' (data lama ikut ter-rename).
alter type public.pipeline_stage rename value 'Handover' to 'Good Receive';
