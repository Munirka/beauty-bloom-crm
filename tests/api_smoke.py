"""Integration checks against a local Beauty Bloom server; each test gets an isolated demo workspace."""
import json,os,unittest,urllib.request,urllib.error,http.cookiejar,concurrent.futures,datetime
BASE=os.environ.get('BEAUTY_TEST_URL','http://127.0.0.1:5173')
class API:
 def __init__(self):
  self.jar=http.cookiejar.CookieJar();self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
 def call(self,path,body=None,origin=True,token=None):
  h={};method='GET' if body is None else 'POST'
  if body is not None:h['Content-Type']='application/json'
  if origin:h['Origin']=BASE
  if token:h['Authorization']='Bearer '+token
  req=urllib.request.Request(BASE+'/api/'+path,data=None if body is None else json.dumps(body).encode(),headers=h,method=method)
  try:
   with self.opener.open(req,timeout=20) as r:return r.status,json.load(r)
  except urllib.error.HTTPError as e:return e.code,json.load(e)
class CRM(unittest.TestCase):
 def setUp(self):
  self.api=API();status,self.d=self.api.call('bootstrap');self.assertEqual(status,200)
  self.date=(datetime.date.fromisoformat(self.d['today'])+datetime.timedelta(days=1))
  while self.date.weekday()==6:self.date+=datetime.timedelta(days=1)
  self.date=str(self.date);self.m=self.d['masters'][0];self.s=self.d['services'][0]
  self.booking={'client':{'name':'Тестовый Клиент','phone':'+70000001001','email':'test@example.com','consent':True},'serviceId':self.s['id'],'masterId':self.m['id'],'date':self.date,'start':840}
 def create(self):
  code,result=self.api.call('appointments',self.booking);self.assertEqual(code,200,result);return result['id']
 def get(self,id):
  code,d=self.api.call('bootstrap');self.assertEqual(code,200);return next(a for a in d['appointments'] if a['id']==id)
 def test_01_persistence(self):
  id=self.create();a=self.get(id);self.assertEqual(a['client_name'],'Тестовый Клиент');self.assertEqual(a['price'],9000)
 def test_02_conflict_and_adjacent(self):
  self.create();code,_=self.api.call('appointments',self.booking);self.assertEqual(code,409)
  for start,expected in [(870,409),(930,200)]:
   self.booking['start']=start;code,res=self.api.call('appointments',self.booking);self.assertEqual(code,expected,res)
 def test_03_concurrent_slot(self):
  with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
   results=list(pool.map(lambda _:self.api.call('appointments',self.booking),range(2)))
  self.assertEqual(sorted(r[0] for r in results),[200,409])
 def test_04_cancel_releases_slot_and_jobs(self):
  id=self.create();a=self.get(id);code,_=self.api.call('appointments/status',{'id':id,'version':a['version'],'status':'cancelled'});self.assertEqual(code,200)
  code,d=self.api.call('bootstrap');self.assertTrue(all(j['status']=='cancelled' for j in d['jobs'] if j['appointment_id']==id))
  self.create()
 def test_05_reschedule_and_stale_write(self):
  id=self.create();code,r=self.api.call('appointments/move',{'id':id,'version':1,'date':self.date,'start':1020,'masterId':self.m['id']});self.assertEqual(code,200,r)
  code,_=self.api.call('appointments/status',{'id':id,'version':1,'status':'cancelled'});self.assertEqual(code,409)
  a=self.get(id);self.assertEqual(a['start'],1020);self.assertEqual(a['status'],'confirmed')
  _,d=self.api.call('bootstrap');self.assertTrue(any(j['status']=='pending' for j in d['jobs'] if j['appointment_id']==id))
 def test_06_completion_rebook_and_revenue(self):
  id=self.create();code,r=self.api.call('appointments/status',{'id':id,'version':1,'status':'completed'});self.assertEqual(code,200,r)
  _,d=self.api.call('bootstrap');self.assertEqual(next(a['status'] for a in d['appointments'] if a['id']==id),'completed')
  self.assertEqual(len([j for j in d['jobs'] if j['appointment_id']==id and j['kind']=='rebook']),1)
  code,_=self.api.call('appointments/status',{'id':id,'version':1,'status':'completed'});self.assertEqual(code,409)
 def test_07_role_enforced_on_server(self):
  code,_=self.api.call('session/role',{'role':'master','masterId':self.m['id']});self.assertEqual(code,200)
  code,d=self.api.call('bootstrap');self.assertEqual(code,200);self.assertTrue(all(a['master_id']==self.m['id'] for a in d['appointments']))
  code,_=self.api.call('appointments',self.booking);self.assertEqual(code,403)
  code,_=self.api.call('settings',{'confirmation':False,'reminder':False,'rebook':False});self.assertEqual(code,403)
 def test_08_workspace_isolation(self):
  other=API();_,d=other.call('bootstrap');self.assertNotEqual(d['workspaceId'],self.d['workspaceId'])
  id=self.create();code,_=other.call('appointments/status',{'id':id,'version':1,'status':'cancelled'});self.assertEqual(code,404)
  self.assertFalse(any(a['id']==id for a in other.call('bootstrap')[1]['appointments']))
 def test_09_public_booking_and_privacy(self):
  visitor=API();path='public?studio='+self.d['workspaceId'];code,d=visitor.call(path);self.assertEqual(code,200)
  self.assertFalse(any('client_name' in a or 'client_phone' in a or 'email' in a for a in d['appointments']))
  code,r=visitor.call(path,self.booking);self.assertEqual(code,200,r);self.assertEqual(self.get(r['id'])['source'],'online')
  self.booking['start']=930;self.booking['client']['email']='real@external.test';code,_=visitor.call(path,self.booking);self.assertEqual(code,400)
 def test_10_validation_and_csrf(self):
  code,_=self.api.call('appointments',self.booking,origin=False);self.assertEqual(code,403)
  self.booking['date']='2026-02-31';code,_=self.api.call('appointments',self.booking);self.assertEqual(code,400)
  self.booking['date']=self.date;self.booking['masterId']=self.d['masters'][2]['id'];code,_=self.api.call('appointments',self.booking);self.assertEqual(code,409)
 def test_11_notification_claim_and_ack(self):
  id=self.create();code,r=self.api.call('integration/key',{});self.assertEqual(code,200);token=r['token']
  code,claim=self.api.call('integration/claim',{},token=token);self.assertEqual(code,200);job=next(j for j in claim['jobs'] if j['kind']=='confirmation' and j['message'].startswith('Beauty Bloom: запись подтверждена'))
  _,second=self.api.call('integration/claim',{},token=token);self.assertFalse(set(j['id'] for j in claim['jobs'])&set(j['id'] for j in second['jobs']))
  code,_=self.api.call('integration/ack',{'id':job['id'],'lease':'wrong','success':True},token=token);self.assertEqual(code,409)
  code,_=self.api.call('integration/ack',{'id':job['id'],'lease':job['lease'],'success':True},token=token);self.assertEqual(code,200)
  code,_=self.api.call('integration/ack',{'id':job['id'],'lease':job['lease'],'success':True},token=token);self.assertEqual(code,409)
 def test_12_working_hours_and_service_snapshot(self):
  id=self.create();code,r=self.api.call('services',{**self.s,'id':self.s['id'],'active':True,'price':11000,'duration':120});self.assertEqual(code,200,r)
  a=self.get(id);self.assertEqual(a['price'],9000);self.assertEqual(a['duration'],90)
  code,r=self.api.call('masters',{**self.m,'id':self.m['id'],'active':True,'end':750});self.assertEqual(code,409,r)
 def test_13_consent_and_paused_flows(self):
  self.booking['client']['consent']=False;id=self.create();_,d=self.api.call('bootstrap');self.assertTrue(all(j['status']=='skipped' for j in d['jobs'] if j['appointment_id']==id))
  code,_=self.api.call('settings',{'confirmation':False,'reminder':False,'rebook':False});self.assertEqual(code,200)
  code,r=self.api.call('automation/demo',{});self.assertEqual(code,200);self.assertEqual(r['count'],0)
if __name__=='__main__':unittest.main(verbosity=2)
