export type ReplacementMediaSpan={id:string;startTime:number;duration:number};
export type ReplacementInteractionSpan={startTime:number;duration:number;template?:string;relatedMediaClipId?:string};

/** The editor preview and the persisted replacement command must agree on review markers. */
export function needsReplacementReview(interaction:ReplacementInteractionSpan,media:ReplacementMediaSpan){
  const overlaps=interaction.startTime<media.startTime+media.duration&&interaction.startTime+interaction.duration>media.startTime;
  return interaction.relatedMediaClipId===media.id||(interaction.template==='region'&&overlaps);
}
