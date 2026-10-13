import {Text,View} from 'react-native';
import {uiTokens} from './tokens';
export const petSpeciesLabel=(species?:string)=>species==='CAT'?'Кошка':species==='DOG'?'Собака':species==='OTHER'?'Другой питомец':'Питомец';
// Initial is an identity marker when the API supplies no photograph, never a substitute photo.
export function PetIdentity({name,species}:{name:string;species?:string}){return <View style={{flexDirection:'row',alignItems:'center',gap:12}}><View accessible={false} style={{width:48,height:48,borderRadius:16,backgroundColor:uiTokens.color.soft,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:22,fontWeight:'700',color:uiTokens.color.primary}}>{name.trim().slice(0,1).toLocaleUpperCase('ru-RU')}</Text></View><View style={{flex:1,gap:4}}><Text style={{fontSize:20,fontWeight:'700',color:uiTokens.color.ink}}>{name}</Text><Text style={{color:uiTokens.color.muted}}>{petSpeciesLabel(species)}</Text></View></View>;}
